import json
import boto3
import base64
from datetime import datetime
from decimal import Decimal

# AWS clients
bedrock = boto3.client('bedrock-runtime', region_name='ap-southeast-2')
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-2')

TABLE_NAME = 'CivicOS-incidents'  # ← update this to match Person 1A's table name

# ------------------------------------------------------------------
# Shared category / scoring rules injected into both prompts
# ------------------------------------------------------------------
_CATEGORY_BLOCK = """
Valid categories and subcategories:
- "Rubbish & Recycling": ["Missed collection", "Illegal dumping", "Bin damage", "Hazardous waste"]
- "Property & Rates": ["Rates dispute", "Valuation complaint", "Property compliance", "Boundary issue"]
- "Resource & Building Consents": ["Consent delay", "Inspection issue", "Building fine dispute", "Consent decision disagreement"]
- "Infrastructure & Roading": ["Pothole", "Streetlight", "Footpath", "Parking infringement", "Road damage"]
- "Noise Complaints": ["Residential noise", "Commercial noise", "Construction noise", "Event noise"]

If the issue does not fit any category, set category to "unsupported".

Valid report_type values: complaint | request | information | notice | emergency
Valid risk_level values: low | medium | high | critical
"""

_SCORING_BLOCK = """
Scoring rules — READ CAREFULLY before assigning numbers:

severity (float 0.0–1.0):
  0.05 = cosmetic eyesore, no safety risk (e.g. faded road markings, minor graffiti)
  0.15 = minor littering, small bin damage, trivial noise once at night
  0.30 = damaged footpath tile, non-hazardous dumping, recurring minor noise
  0.50 = pothole that could injure cyclists / damage tyres; persistent commercial noise; consent delay weeks overdue
  0.65 = streetlight out on a busy road at night; large illegal dump with unknown substances
  0.80 = collapsed road section; exposed electrical wiring; flooded footpath blocking access
  0.90 = road totally impassable; gas smell; large hazardous waste spill
  1.00 = immediate threat to life (fire, structural collapse, blocked emergency-vehicle access)
  → Choose the value that BEST fits these benchmarks. Do NOT default to 0.5.

risk_level — derived STRICTLY from severity:
  0.00–0.25 → "low"
  0.26–0.50 → "medium"
  0.51–0.75 → "high"
  0.76–1.00 → "critical"

confidence (float 0.0–1.0):
  1.0 = report is crystal-clear; category, subcategory, and details are unambiguous
  0.8 = mostly clear but one minor detail is uncertain
  0.6 = reasonable classification but the description is vague in parts
  0.4 = significant ambiguity; multiple categories possible
  0.2 = very thin report; best-guess classification only
  → Choose precisely. Do NOT default to 0.5 or round to 0.0/1.0 unless truly warranted.
"""

_OUTPUT_SCHEMA = """
Required output — respond with ONLY this JSON, no explanation, no markdown:
{
    "category": "...",
    "subcategory": "...",
    "report_type": "...",
    "severity": 0.0,
    "risk_level": "low",
    "location_extracted": "...",
    "summary": "...",
    "confidence": 0.0
}
"""

# ------------------------------------------------------------------
# Prompt for TEXT / AUDIO submissions
# AI must extract location from the content itself.
# ------------------------------------------------------------------
CLASSIFICATION_PROMPT_TEXT_AUDIO = (
    "You are a civic issue classifier for Auckland City Council, New Zealand.\n"
    "Classify the citizen report below.\n"
    + _CATEGORY_BLOCK
    + _SCORING_BLOCK
    + """
location_extracted rules:
  - Extract the most specific Auckland location mentioned (street address, intersection, suburb, well-known Auckland landmark or building).
  - Acceptable: "142 Queen Street, Auckland CBD", "corner of Ponsonby Road and Franklin Road", "in front of Sky Tower on Federal Street", "Newmarket train station".
  - NOT acceptable: vague references with no real place name, e.g. "the road near me", "middle of the road", "down the street", "by a park".
  - If the report does not contain a recognisable Auckland street name, suburb, or landmark, set location_extracted to exactly: "not enough location info"
  - Never invent or guess a street name. Only use place names explicitly stated in the report.
"""
    + _OUTPUT_SCHEMA
    + "\nCitizen report:\n"
)

# ------------------------------------------------------------------
# Prompt for IMAGE submissions
# Location is already known (provided by the user separately).
# AI analyses the visual content only.
# ------------------------------------------------------------------
CLASSIFICATION_PROMPT_IMAGE = (
    "You are a civic issue classifier for Auckland City Council, New Zealand.\n"
    "A citizen has submitted an IMAGE as a civic complaint. Analyse the visual content.\n"
    "The location has already been provided separately — do NOT attempt to read or infer a location from the image.\n"
    + _CATEGORY_BLOCK
    + _SCORING_BLOCK
    + """
location_extracted: Set this to exactly the value provided in the LOCATION field below — copy it verbatim.

summary: One formal sentence describing the issue visible in the image, suitable for a council officer.

confidence guidance (image-specific):
  1.0 = issue is unmistakably clear in the image (e.g. obvious pothole, clear dumped rubbish)
  0.7 = issue is visible but lighting/angle adds minor uncertainty
  0.4 = image is dark, blurry, or partially obscured
  0.1 = cannot determine issue type from image
"""
    + _OUTPUT_SCHEMA
    + "\nLOCATION: {location}\nIMAGE CAPTION (optional): "
)

def convert_floats(obj):
    """Convert all floats to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats(i) for i in obj]
    return obj

def classify_with_nova(text_content, input_type='text', provided_location=None,
                       image_base64=None, image_media_type=None):
    """Send content to Nova and get back structured classification.
    
    - input_type='image'  → image prompt, location injected from provided_location
    - input_type='voice' or 'text' → text/audio prompt, AI extracts location
    """
    
    messages_content = []
    
    # Build the correct prompt based on input type
    if input_type == 'image':
        # Inject the user-supplied location into the image prompt
        location_str = provided_location or 'not specified'
        prompt_prefix = CLASSIFICATION_PROMPT_IMAGE.replace('{location}', location_str)
        caption = text_content or 'No caption provided.'

        # Add the image bytes first (Nova expects image before text in multimodal)
        if image_base64:
            messages_content.append({
                "image": {
                    "format": image_media_type.split('/')[-1],  # e.g. "jpeg"
                    "source": {
                        # Nova accepts base64-encoded string inside the JSON body
                        "bytes": image_base64
                    }
                }
            })
        messages_content.append({"text": prompt_prefix + caption})

    else:
        # text or voice — AI must extract location from the content
        messages_content.append({
            "text": CLASSIFICATION_PROMPT_TEXT_AUDIO + text_content
        })
    
    response = bedrock.invoke_model(
        modelId='amazon.nova-pro-v1:0',
        body=json.dumps({
            "messages": [
                {
                    "role": "user",
                    "content": messages_content
                }
            ],
            "inferenceConfig": {
                "maxTokens": 600,
                "temperature": 0.1  # Low temp = more deterministic classification
            }
        })
    )
    
    result = json.loads(response['body'].read())
    raw_text = result['output']['message']['content'][0]['text']
    
    # Strip any accidental markdown fences before parsing
    clean = raw_text.strip()
    if clean.startswith('```'):
        clean = clean.split('```')[1]
        if clean.startswith('json'):
            clean = clean[4:]
    
    ai_result = json.loads(clean.strip())

    # --- Post-process image results: always override location_extracted
    # with the user-supplied value so AI cannot override it ---
    if input_type == 'image':
        ai_result['location_extracted'] = provided_location or 'not specified'

    return ai_result


def transcribe_audio(s3_bucket, s3_key, incident_id):
    """Use Amazon Transcribe to convert voice to text."""
    transcribe = boto3.client('transcribe', region_name='ap-southeast-2')
    
    job_name = f"civicos-{incident_id}-{int(datetime.now().timestamp())}"
    
    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={'MediaFileUri': f's3://{s3_bucket}/{s3_key}'},
        MediaFormat='ogg',  # webm with opus is treated as ogg by Transcribe
        LanguageCode='en-NZ'
    )
    
    # Wait for job to complete (poll every 5 seconds)
    import time
    while True:
        status = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        job_status = status['TranscriptionJob']['TranscriptionJobStatus']
        
        if job_status == 'COMPLETED':
            transcript_uri = status['TranscriptionJob']['Transcript']['TranscriptFileUri']
            # Fetch the transcript text
            import urllib.request
            with urllib.request.urlopen(transcript_uri) as f:
                transcript_data = json.loads(f.read())
            return transcript_data['results']['transcripts'][0]['transcript']
        
        elif job_status == 'FAILED':
            raise Exception(f"Transcription failed for job {job_name}")
        
        time.sleep(5)


def update_dynamodb(incident_id, status, ai_analysis, transcript=None):
    """Write results back to the shared DynamoDB table."""
    table = dynamodb.Table(TABLE_NAME)
    
    update_expr = "SET #s = :status, ai_analysis = :analysis, processed_at = :time"
    expr_names = {"#s": "status"}
    expr_values = {
        ":status": status,
        ":analysis": convert_floats(ai_analysis),
        ":time": datetime.utcnow().isoformat()
    }
    
    if transcript:
        update_expr += ", transcript = :transcript"
        expr_values[":transcript"] = transcript
    
    table.update_item(
        Key={"incident_id": incident_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values
    )


def lambda_handler(event, context):
    """
    Main entry point. Person 1A calls this with:
    {
        "incident_id": "abc-123",
        "input_type": "text" | "voice" | "image",
        "text_content": "...",           # for text input
        "s3_bucket": "...",              # for voice/image
        "s3_key": "...",                 # for voice/image
        "image_base64": "...",           # optional, for image
        "image_media_type": "image/jpeg" # optional, for image
    }
    """
    
    incident_id = event['incident_id']
    input_type = event['input_type']
    transcript = None
    
    try:
        # --- VOICE: transcribe first, then classify ---
        if input_type == 'voice':
            transcript = transcribe_audio(event['s3_bucket'], event['s3_key'], incident_id)
            ai_result = classify_with_nova(
                text_content=transcript,
                input_type='voice',
            )
        
        # --- IMAGE: location from user input, context from the image ---
        elif input_type == 'image':
            caption = event.get('text_content', '')
            provided_location = event.get('location', '')

            # Fetch the image bytes from S3 and encode as base64 string for Nova
            s3_client = boto3.client('s3', region_name='ap-southeast-2')
            s3_obj = s3_client.get_object(
                Bucket=event['s3_bucket'],
                Key=event['s3_key'],
            )
            image_bytes = s3_obj['Body'].read()
            image_b64 = base64.b64encode(image_bytes).decode('utf-8')

            # Infer media type from S3 key extension
            s3_key = event['s3_key']
            if s3_key.endswith('.png'):
                media_type = 'image/png'
            elif s3_key.endswith('.webp'):
                media_type = 'image/webp'
            else:
                media_type = 'image/jpeg'

            ai_result = classify_with_nova(
                text_content=caption,
                input_type='image',
                provided_location=provided_location,
                image_base64=image_b64,
                image_media_type=media_type,
            )
        
        # --- TEXT: send directly to Nova for both location extraction and classification ---
        else:
            ai_result = classify_with_nova(
                text_content=event['text_content'],
                input_type='text',
            )
        
        # Determine final status
        location_val = ai_result.get('location_extracted', '')
        if location_val == 'not enough location info':
            # Text/audio report did not contain a recognisable Auckland location —
            # front end will prompt the citizen to re-submit with a specific address.
            final_status = 'needs_location'
        elif ai_result.get('category') == 'unsupported':
            final_status = 'unsupported'
        else:
            final_status = 'analyzed'
        
        # Write to DynamoDB
        update_dynamodb(incident_id, final_status, ai_result, transcript)
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "incident_id": incident_id,
                "status": final_status,
                "category": ai_result.get('category')
            })
        }
    
    except Exception as e:
        # Mark as failed so Person 1A can show an error state
        update_dynamodb(incident_id, 'processing_failed', {"error": str(e)})
        raise e