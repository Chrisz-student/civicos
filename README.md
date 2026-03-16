# CivicOS

Report local issues in seconds. CivicOS turns a photo, voice note, or text into a
formally worded complaint — complete with NZ legislation — routed to the right
council department automatically.

## What it does

Most people don't report civic issues because they don't know who to contact or how
to word a complaint. CivicOS fixes that. Describe what you see, and our AI:

- Classifies the issue into a category
- Attaches the relevant NZ legislation (Resource Management Act, Local Government
  Act, Building Act, etc.)
- Routes it to the correct council department
- Sends a professionally worded email on your behalf
- CC's you automatically so you have a paper trail

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Cloud:** AWS (S3, Lambda, DynamoDB, SES)
- **AI:** Amazon Nova (classification), Amazon Transcribe (voice)

## Getting Started

### Prerequisites
- Node.js
- AWS account with SES, Lambda, S3, and DynamoDB configured

### Installation

git clone https://github.com/Chrisz-student/civicos
cd civicos
npm install
npm run dev

### Note on AWS SES
AWS SES starts in sandbox mode, which limits outbound email to pre-verified
addresses. To send to any citizen email, you'll need to apply for SES production
access in your AWS console.
