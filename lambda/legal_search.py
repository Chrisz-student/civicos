# lambda_function.py
# Person 2B — Routing + Legal Context + Email Generation + SES

import base64
import boto3
import json
import os
from datetime import datetime

from legal_data import LEGAL_DATABASE, AUTHORITY_MAP

bedrock = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('CivicOS-incidents')
ses_client = boto3.client('ses', region_name='ap-southeast-2')


def lambda_handler(event, context):
    
    # ──────────────────────────────────────────────
    # STEP 1: GET THE INCIDENT FROM DYNAMODB
    # ──────────────────────────────────────────────
    
    # If triggered by DynamoDB stream
    for record in event.get('Records', []):
        if record.get('eventName') in ['MODIFY', 'INSERT']:
            new_image = record['dynamodb']['NewImage']
            incident_id = new_image['incident_id']['S']
            status = new_image['status']['S']
            
            # Only process if status is "analyzed"
            if status != 'analyzed':
                continue
            
            try:
                process_incident(incident_id)
            except Exception as e:
                print(f"[ERROR] process_incident failed for {incident_id}: {e}")
                update_status(incident_id, 'failed')
    
    return {'statusCode': 200}


def process_incident(incident_id):
    
    # Read full record from DynamoDB (strongly consistent so we always get fresh data)
    response = table.get_item(Key={'incident_id': incident_id}, ConsistentRead=True)
    incident = response.get('Item')
    
    if not incident:
        print(f"Incident {incident_id} not found")
        return
    
    ai_analysis = incident.get('ai_analysis', {})
    category = ai_analysis.get('category')
    subcategory = ai_analysis.get('subcategory')
    
    # Don't process unsupported issues
    if category == 'unsupported':
        return
    
    # Update status to routing
    update_status(incident_id, 'routing')
    
    # ──────────────────────────────────────────────
    # STEP 2: LOOK UP LEGAL CONTEXT
    # ──────────────────────────────────────────────
    
    legal_info = get_legal_context(category, subcategory)
    authority = get_authority(category)
    
    if not authority:
        print(f"No authority found for category: {category}")
        update_status(incident_id, 'failed')
        return
    
    # ──────────────────────────────────────────────
    # STEP 3: GENERATE EMAIL USING NOVA
    # ──────────────────────────────────────────────
    
    email_body = generate_email(incident, legal_info, authority)

    if not email_body:
        print(f"Email generation failed for {incident_id}")
        update_status(incident_id, 'failed')
        return
    
    # ──────────────────────────────────────────────
    # STEP 4: SEND VIA SES
    # ──────────────────────────────────────────────
    
    citizen_email = incident.get('input', {}).get('citizen_email')
    location = incident.get('input', {}).get('location', ai_analysis.get('location_extracted', 'Auckland'))
    s3_key = incident.get('input', {}).get('s3_key', '')
    subject = f"[CivicOS] Formal Notice: {subcategory} — {incident_id}"
    
    ses_result = send_email(
        # to_email=authority['email'],
        # to_email='alexxienz02@gmail.com',  # TEST OVERRIDE
        to_email='zxie089@aucklanduni.ac.nz',  # TEST OVERRIDE
        from_email=citizen_email,
        cc_email=None,  # TEST OVERRIDE
        subject=subject,
        body=email_body,
        s3_key=s3_key
    )
    
    if not ses_result:
        # Retry once
        ses_result = send_email(
            to_email='zxie089@aucklanduni.ac.nz',  # TEST OVERRIDE
            from_email=citizen_email,
            cc_email=None,  # TEST OVERRIDE
            subject=subject,
            body=email_body,
            s3_key=s3_key
        )
    
    # ──────────────────────────────────────────────
    # STEP 5: UPDATE DYNAMODB
    # ──────────────────────────────────────────────
    
    if ses_result:
        table.update_item(
            Key={'incident_id': incident_id},
            UpdateExpression='''
                SET #s = :status, 
                    updated_at = :ts,
                    legal_context = :legal, 
                    routing = :routing, 
                    email = :email
            ''',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'sent',
                ':ts': datetime.utcnow().isoformat() + 'Z',
                ':legal': {
                    'laws_cited': legal_info
                },
                ':routing': {
                    'authority': authority['department'],
                    'email': authority['email'],
                    'escalation': authority.get('escalation_email', '')
                },
                ':email': {
                    'ses_message_id': ses_result,
                    'sent_at': datetime.utcnow().isoformat() + 'Z',
                    'cc_citizen': citizen_email is not None,
                    'generated_body': email_body
                }
            }
        )
    else:
        update_status(incident_id, 'failed')


def get_legal_context(category, subcategory):
    """Look up laws from the hardcoded legal database."""
    
    category_data = LEGAL_DATABASE.get(category, {})
    subcategory_data = category_data.get(subcategory, {})
    laws = subcategory_data.get('laws', [])
    
    if not laws:
        # Fallback: try to get any law from the category
        for sub in category_data.values():
            if isinstance(sub, dict) and 'laws' in sub:
                laws = sub['laws']
                break
    
    return laws


def get_authority(category):
    """Look up the responsible authority."""
    return AUTHORITY_MAP.get(category)


def get_severity_label(severity):
    """Convert numeric severity to human-readable label."""
    try:
        score = float(severity)
        if score >= 0.8:
            return 'High'
        elif score >= 0.5:
            return 'Medium'
        elif score >= 0.3:
            return 'Low'
        else:
            return 'Minor'
    except (ValueError, TypeError):
        return 'N/A'


def format_laws_for_prompt(laws):
    """Format laws into readable text for the Nova prompt."""
    
    formatted = []
    for i, law in enumerate(laws, 1):
        entry = f"{i}. {law['act']}, {law['section']}"
        entry += f"\n   → {law['says']}"
        entry += f"\n     Council obligation: {law['council_must']}"
        entry += f"\n     Required timeframe: {law['timeframe']}."
        if 'case_ref' in law:
            entry += f"\n   → Reference: {law['case_ref']}"
        formatted.append(entry)
    return "\n\n".join(formatted)


def generate_email(incident, legal_info, authority):
    """Use Nova to generate a formal notice email."""
    
    ai = incident.get('ai_analysis', {})
    inp = incident.get('input', {})
    incident_id = incident['incident_id']
    
    # Extract citizen details
    citizen_name = inp.get('citizen_name', 'The reporting citizen')
    citizen_email = inp.get('citizen_email', '')
    
    # Build severity with human-readable label
    severity = ai.get('severity', 'N/A')
    severity_label = get_severity_label(severity)
    
    # Build the S3 evidence link with capture timestamp
    s3_key = inp.get('s3_key', '')
    photo_date_time = inp.get('photo_date_time', incident.get('created_at', 'date not recorded'))
    evidence_line = f"- Photograph: s3://civicos-uploads/{s3_key} (captured {photo_date_time})" if s3_key else "Text report only — no media attached."

    # Image is embedded inline by send_email — no pre-signed URL needed
    
    # Build the prompt
    prompt = f"""# ROLE
You are a legal communications drafter for CivicOS, an automated civic reporting platform operating in New Zealand. You write formal infrastructure notices on behalf of named citizens to local government authorities. Your tone is professional, firm, and factual — assertive but never hostile.

# CONTEXT
CivicOS submits formal documented notices to {authority['department']} when citizens report infrastructure hazards. These notices must:
- Serve as formal legal notice of a known hazard
- Be taken seriously by government recipients
- Be accurate in all legal citations
- Be written on behalf of a named citizen (not from an anonymous automated system)

# INCIDENT DATA
- Report ID: {incident_id}
- Reporter: {citizen_name}, Auckland ratepayer
- Reporter Email (CC): {citizen_email}
- Date Reported: {incident.get('created_at', 'Not specified')}
- Category: {ai.get('category', '').replace('_', ' ').title()}
- Subcategory: {ai.get('subcategory', '').replace('_', ' ').title()}
- Report Type: {ai.get('report_type', 'complaint').title()}
- Severity: {severity_label} ({severity} / 1.0)
- Risk Level: {ai.get('risk_level', 'N/A').title()}
- Location: {inp.get('location', ai.get('location_extracted', 'Not specified'))}
- Description: {ai.get('summary', 'No summary available.')}

# EVIDENCE
{evidence_line}

# LEGAL FRAMEWORK
Cite ONLY the following legal obligations. Do not fabricate or misattribute any legal provisions.

{format_laws_for_prompt(legal_info)}

# OUTPUT FORMAT
Output ONLY the plain text email body. Do not include a subject line. Do not use any markdown formatting — no ##, no **, no __, no bullet dashes with bold. Use plain text only.

Structure the body as follows:

[Opening paragraph — 2 sentences]
State that this constitutes formal documented notice and reference the overarching legal basis briefly.

INCIDENT DETAILS
Reference:    [incident_id]
Location:     [location]
Description:  [description]
Severity:     [severity_label] ([severity]/1.0)
Risk Level:   [risk level]
Reported:     [date]

EVIDENCE
[If a photo was submitted, write only: "Photograph captured on [date/time]." Do NOT include any s3:// links, URLs, or file paths — the image will be embedded separately.]

LEGAL BASIS
[Single paragraph weaving in the legal citations as flowing prose. Keep concise.]

REQUESTED ACTION
[1–2 sentences requesting repair/action, referencing {authority['department']}'s response timeframe of {authority.get('response_timeframe', 'a reasonable timeframe')}.]

[Closing — state that {citizen_name} has been copied on this notice.]

Yours faithfully,

CivicOS — Automated Civic Reporting Platform
On behalf of {citizen_name}, Auckland ratepayer
Report ID: {incident_id}

Do NOT Include:
- Markdown symbols of any kind (##, **, --, etc.)
- A confidentiality footer
- Threats or adversarial language
- Legal citations not listed in the LEGAL FRAMEWORK section above
- Unexplained numeric severity scores without human-readable labels

# TONE GUIDELINES
- Professional and measured
- Assertive but cooperative — assume good faith on first contact
- The implicit message is: "We've documented this. The clock is now ticking." Let the structure and citations convey urgency rather than aggressive language.

# ESCALATION PATH
If no response is received within {authority.get('response_timeframe', 'a reasonable timeframe')}, this matter will be escalated to {authority.get('escalation_body', 'the Ombudsman')}.

# QUALITY CHECKS (Self-verify before outputting)
- [ ] Every legal citation matches the LEGAL FRAMEWORK section exactly
- [ ] The citizen's name ({citizen_name}) appears (not just "CivicOS")
- [ ] Severity is presented as "{severity_label} ({severity}/1.0)" not just "{severity}/1.0"
- [ ] Photo evidence includes capture date/time
- [ ] The CC line names the citizen explicitly
- [ ] No confidentiality footer is included
- [ ] The email could pass review by a municipal lawyer"""

    try:
        response = bedrock.invoke_model(
            modelId='amazon.nova-pro-v1:0',
            body=json.dumps({
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "text": prompt
                            }
                        ]
                    }
                ],
                "inferenceConfig": {
                    "maxTokens": 2048,
                    "temperature": 0.2
                }
            })
        )
        
        result = json.loads(response['body'].read())
        return result['output']['message']['content'][0]['text']
        
    except Exception as e:
        print(f"Bedrock Error: {e}")
        return ""


def _render_email_html(body, image_data_uri=None):
    """Convert plain text email body to styled HTML."""
    section_headers = {
        'INCIDENT DETAILS', 'LEGAL BASIS', 'REQUESTED ACTION'
    }
    lines = body.splitlines()
    html_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped in section_headers:
            html_lines.append(f'<h3 style="color:#1a1a1a;border-bottom:1px solid #cccccc;padding-bottom:4px;margin-top:24px;">{stripped}</h3>')
        elif ':' in stripped and stripped.split(':')[0].rstrip() in (
            'Reference', 'Location', 'Description', 'Severity', 'Risk Level', 'Reported'
        ):
            label, _, value = stripped.partition(':')
            html_lines.append(
                f'<p style="margin:4px 0;"><strong>{label.strip()}:</strong> {value.strip()}</p>'
            )
        elif stripped == 'EVIDENCE':
            html_lines.append('<h3 style="color:#1a1a1a;border-bottom:1px solid #cccccc;padding-bottom:4px;margin-top:24px;">EVIDENCE</h3>')
            if image_data_uri:
                # Base64 data URI — image bytes are baked into the HTML, no external request needed.
                # Works in Gmail, Outlook, Apple Mail, and all university/corporate clients.
                html_lines.append(f'<div style="margin:12px 0;"><img src="{image_data_uri}" alt="Incident photograph" style="max-width:100%;max-height:400px;border:1px solid #ddd;border-radius:4px;"></div>')
        elif 's3://' in stripped or (stripped.startswith('http') and 'civicos-uploads' in stripped):
            pass  # suppress raw S3 links
        elif stripped == '':
            html_lines.append('<br>')
        else:
            html_lines.append(f'<p style="margin:6px 0;">{stripped}</p>')

    return f'''<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;max-width:700px;margin:auto;padding:32px;">
  <div style="border-top:4px solid #003087;padding-top:16px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
    <div style="background:#003087;color:white;font-size:13px;font-weight:bold;padding:6px 12px;border-radius:3px;letter-spacing:0.5px;">AUCKLAND COUNCIL</div>
    <span style="font-size:12px;color:#003087;font-weight:bold;">CivicOS</span>
    <span style="font-size:11px;color:#666;">— Automated Civic Reporting Platform</span>
  </div>
  {''.join(html_lines)}
  <hr style="margin-top:32px;border:none;border-top:1px solid #e0e0e0;">
  <p style="font-size:11px;color:#999;margin-top:8px;">This notice was automatically generated by CivicOS on behalf of the reporting citizen. Do not reply to this automated message.</p>
</body>
</html>'''


def send_email(to_email, from_email, cc_email, subject, body, s3_key=None):
    """
    Send email via SES.
    The incident photo (if any) is fetched from S3, base64-encoded, and embedded
    as a data URI (<img src="data:image/jpeg;base64,...">) directly in the HTML body.
    This is the only approach that works universally across Gmail, Outlook, Apple Mail,
    and corporate/university email clients without requiring external image loading.
    """

    # ── 1. Fetch image from S3 and encode as base64 data URI ─────────────────
    image_data_uri = None
    if s3_key:
        try:
            s3_client = boto3.client('s3', region_name='ap-southeast-2')
            obj = s3_client.get_object(Bucket='civicos-uploads-818648487714', Key=s3_key)
            image_bytes = obj['Body'].read()

            key_lower = s3_key.lower()
            if key_lower.endswith('.png'):
                mime_type = 'image/png'
            elif key_lower.endswith('.gif'):
                mime_type = 'image/gif'
            elif key_lower.endswith('.webp'):
                mime_type = 'image/webp'
            else:
                mime_type = 'image/jpeg'

            encoded = base64.b64encode(image_bytes).decode('utf-8')
            image_data_uri = f"data:{mime_type};base64,{encoded}"
            print(f"[SES DEBUG] Image encoded: {len(image_bytes)} raw bytes → {len(encoded)} base64 chars")
        except Exception as e:
            print(f"[SES DEBUG] Could not fetch/encode image from S3: {e}")

    # ── 2. Build and send the email ───────────────────────────────────────────
    html_content = _render_email_html(body, image_data_uri=image_data_uri)

    destination = {'ToAddresses': [to_email]}
    if cc_email:
        destination['CcAddresses'] = [cc_email]

    print(f"[SES DEBUG] Sending email {'with embedded image' if image_data_uri else '(no image)'} ...")
    print(f"[SES DEBUG] From: {from_email} → To: {to_email}, Subject: {subject}")

    try:
        response = ses_client.send_email(
            Source=from_email,
            Destination=destination,
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': body, 'Charset': 'UTF-8'},
                    'Html': {'Data': html_content, 'Charset': 'UTF-8'}
                }
            }
        )
        print(f"[SES DEBUG] Email sent! Message ID: {response['MessageId']}")
        return True

    except Exception as e:
        print(f"[SES DEBUG] Error sending email: {e}")
        print(f"[SES DEBUG] Error type: {type(e).__name__}")
        if hasattr(e, 'response'):
            print(f"[SES DEBUG] AWS error: {e.response['Error']['Code']} — {e.response['Error']['Message']}")
        return False


def update_status(incident_id, status):
    """Quick status update helper."""
    table.update_item(
        Key={'incident_id': incident_id},
        UpdateExpression='SET #s = :status, updated_at = :ts',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':status': status,
            ':ts': datetime.utcnow().isoformat() + 'Z'
        }
    )