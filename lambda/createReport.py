# ============================================
# Lambda: createReport
# Triggered by: POST /reports
# 
# What it does:
# 1. Generates an incident ID (CIV-2025-XXXXX)
# 2. Writes the initial record to DynamoDB
# 3. Generates a presigned S3 URL for file upload
# 4. Returns { incident_id, upload_url }
# ============================================

import json
import os
import random
import boto3
from datetime import datetime, timezone
from decimal import Decimal

# AWS clients
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
lambda_client = boto3.client('lambda', region_name='ap-southeast-2')

# Environment variables (set in Lambda config)
TABLE_NAME = os.environ.get('TABLE_NAME', 'CivicOS-incidents')
UPLOAD_BUCKET = os.environ.get('UPLOAD_BUCKET', 'civicos-uploads-818648487714')
AI_PROCESSOR_FUNCTION = os.environ.get('AI_PROCESSOR_FUNCTION', 'CivicOS-ai-processor')


def convert_floats(obj):
    """Recursively convert floats to Decimal for DynamoDB compatibility"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats(i) for i in obj]
    return obj


def generate_incident_id():
    """Generate a unique incident ID like CIV-2025-54299"""
    num = random.randint(10000, 99999)
    year = datetime.now().year
    return f"CIV-{year}-{num}"


def lambda_handler(event, context):
    """Main handler — called by API Gateway"""
    
    # CORS headers (needed so the browser allows the request)
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    
    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    try:
        # Parse the request body
        body = json.loads(event.get('body', '{}'))
        
        text_content = body.get('text_content', '')
        location = body.get('location', '')
        gps = body.get('gps', {'lat': 0, 'lng': 0})
        citizen_email = body.get('citizen_email', '')
        input_type = body.get('input_type', 'text')      # primary: 'voice', 'image', or 'text'
        content_type = body.get('content_type', '')       # e.g. 'image/png', 'image/jpeg'
        image_content_type = body.get('image_content_type', '')  # set when uploading both voice + image
        
        # Validate required fields
        if not citizen_email:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'citizen_email is required'}),
            }
        
        # Generate incident ID
        incident_id = generate_incident_id()
        
        # Determine file extension for S3 key
        ext_map = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'audio/webm': 'webm',
        }
        if content_type and content_type in ext_map:
            ext = ext_map[content_type]
        else:
            ext = {'image': 'jpg', 'voice': 'webm', 'text': 'txt'}.get(input_type, 'txt')
        s3_key = f"uploads/{input_type}/{incident_id}.{ext}"
        
        # Build the DynamoDB record
        item = {
            'incident_id': incident_id,
            'status': 'submitted',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'input': {
                'type': input_type,
                's3_key': s3_key,
                'text_content': text_content,
                'location': location,
                'gps': gps,
                'citizen_email': citizen_email,
            },
        }
        
        # Convert floats to Decimal (DynamoDB doesn't accept Python floats)
        item = convert_floats(item)
        
        # Write to DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        table.put_item(Item=item)
        
        # Invoke Person 1B's AI processor Lambda (async — don't wait for result)
        lambda_client.invoke(
            FunctionName=AI_PROCESSOR_FUNCTION,
            InvocationType='Event',  # async fire-and-forget
            Payload=json.dumps({
                'incident_id': incident_id,
                'input_type': input_type,
                'text_content': text_content,
            }),
        )
        
        # Generate presigned URL for file upload (valid for 5 minutes)
        # ContentType MUST be in the presigned URL and match what the browser sends exactly
        upload_url = ''
        image_upload_url = ''

        if input_type in ('image', 'voice'):
            if not content_type:
                content_type = 'image/jpeg' if input_type == 'image' else 'audio/webm'
            upload_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': UPLOAD_BUCKET,
                    'Key': s3_key,
                    'ContentType': content_type,
                },
                ExpiresIn=300,
            )

        # If user submitted BOTH voice + image, also generate a presigned URL for the image
        if input_type == 'voice' and image_content_type:
            image_ext = 'png' if image_content_type == 'image/png' else 'jpg'
            image_s3_key = f"uploads/image/{incident_id}.{image_ext}"
            image_upload_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': UPLOAD_BUCKET,
                    'Key': image_s3_key,
                    'ContentType': image_content_type,
                },
                ExpiresIn=300,
            )
        
        # Return success
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'incident_id': incident_id,
                'upload_url': upload_url,
                'image_upload_url': image_upload_url,  # non-empty only when voice + image both present
            }),
        }
    
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'}),
        }
