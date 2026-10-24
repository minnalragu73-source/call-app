# Team Call Transcriber - setup (about 15 minutes, once)

What it is: a web app. Up to 15 people open one link in Chrome on Android, join a
voice call, and each person's own speech is typed automatically with their name.
Anyone can download the full transcript as Excel (.xls) or Word (.doc).
No Claude account or app install is needed for your team.

## Deploy free on Render.com
1. Create a free account at github.com and a new repository. Upload all files in
   this folder (server.js, package.json, README.md and the public folder).
2. Create a free account at render.com, click New > Web Service, and connect the repository.
3. Settings: Runtime = Node, Build Command = `npm install`, Start Command = `npm start`, Plan = Free.
4. Under Environment, add:
   - PASSCODE = a secret word your team will type to join (strongly recommended)
5. Click Deploy. Render gives you a link like https://your-app.onrender.com
   Share that link with the team. Render's free plan sleeps after 15 minutes of
   no use, so the first open takes about 30-60 seconds.

## If voices do not connect between some phones
Phones on mobile data sometimes need a relay (TURN server). Get free TURN
credentials (for example the Open Relay free tier from metered.ca) and add this
environment variable on Render:
ICE_SERVERS = [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:YOUR_HOST:80","username":"YOUR_USER","credential":"YOUR_PASS"}]

## Notes
- Transcripts are kept in server memory only. Download them after each call;
  they are lost when the server restarts or sleeps.
- Everyone should use headphones, or the microphone also picks up other voices.
- Each person chooses Tamil or English before joining. Proofread the output.
- Run locally for a test: `npm install` then `npm start`, open http://localhost:3000
  (the microphone works on localhost; on other devices it needs https).
