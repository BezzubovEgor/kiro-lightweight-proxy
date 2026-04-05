#!/usr/bin/env node
/**
 * Example usage script
 */

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Kiro Lightweight Proxy - Usage Examples
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Login with AWS Builder ID
   $ node server.js --login

2️⃣  Start the proxy server
   $ node server.js

3️⃣  Test with curl
   $ curl http://localhost:3000/v1/chat/completions \\
     -H "Content-Type: application/json" \\
     -d '{
       "model": "claude-sonnet-4.5",
       "messages": [{"role": "user", "content": "Hello!"}],
       "stream": true
     }'

4️⃣  Use with OpenClaw
   Base URL: http://localhost:3000
   Model: claude-sonnet-4.5
   API Key: (leave empty)

5️⃣  Use with Python OpenAI SDK
   from openai import OpenAI
   
   client = OpenAI(
       base_url="http://localhost:3000/v1",
       api_key="not-needed"
   )
   
   response = client.chat.completions.create(
       model="claude-sonnet-4.5",
       messages=[{"role": "user", "content": "Hello!"}],
       stream=True
   )
   
   for chunk in response:
       print(chunk.choices[0].delta.content, end="")

6️⃣  Use with Node.js
   import OpenAI from 'openai';
   
   const client = new OpenAI({
     baseURL: 'http://localhost:3000/v1',
     apiKey: 'not-needed',
   });
   
   const stream = await client.chat.completions.create({
     model: 'claude-sonnet-4.5',
     messages: [{ role: 'user', content: 'Hello!' }],
     stream: true,
   });
   
   for await (const chunk of stream) {
     process.stdout.write(chunk.choices[0]?.delta?.content || '');
   }

7️⃣  Check token status
   $ node server.js --info

8️⃣  Logout
   $ node server.js --logout

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 For more info, see README.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
