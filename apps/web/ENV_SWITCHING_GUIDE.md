# 🔧 Switch Environment Configuration

## Quick Commands

### Use LOCAL backend (localhost:8080)

```powershell
Copy-Item .env.localhost .env.local -Force
# Then restart: npm run dev
```

### Use NGROK backend (remote access)

```powershell
Copy-Item .env.ngrok .env.local -Force
# Then restart: npm run dev
```

## Files

- `.env.local` - Active configuration (DO NOT commit)
- `.env.localhost` - Template for local development
- `.env.ngrok` - Template for remote access via ngrok

## Important Notes

- After switching, you MUST restart the frontend server
- Clear browser cache after switching (Ctrl+Shift+R)
- Both modes use the same database, so data is identical
