# ============================================
# Lambda: getReportStatus
# Triggered by: GET /reports/{incidentId}
#
# What it does:
# 1. Reads the incident record from DynamoDB
# 2. Returns the full record (including AI analysis if done)
# ============================================

import json
import os
import boto3
from decimal import Decimal

# AWS client
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('TABLE_NAME', 'CivicOS-incidents')


class DecimalEncoder(json.JSONEncoder):
    """Convert DynamoDB Decimal values to float for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    try:
        # Get the incident ID from the URL path: /reports/{incidentId}
        incident_id = event.get('pathParameters', {}).get('incidentId')

        if not incident_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'incidentId is required'}),
            }

        # Read from DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        response = table.get_item(Key={'incident_id': incident_id})
        item = response.get('Item')

        if not item:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Report not found'}),
            }

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(item, cls=DecimalEncoder),
        }

    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}),
        }