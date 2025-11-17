# Tailscale Access Troubleshooting Guide

## VM Status: ✅ CONFIRMED WORKING

### Service Verification (Tested on 2025-11-13)

**VM Details:**
- Name: `graphdone-clean`
- Tailscale IP: `100.81.29.39`
- Hostname: `graphdone-clean.chocolate-perch.ts.net`

**Services Running and Responding:**
- ✅ Web UI: `http://100.81.29.39:3127` - HTTP 200
- ✅ GraphQL API: `http://100.81.29.39:4127/graphql` - HTTP 400 (expected - needs POST)
- ✅ Neo4j Browser: `http://100.81.29.39:7474` - HTTP 200
- ✅ All ports listening on `0.0.0.0` (accepting external connections)
- ✅ Tailscale connected and active
- ✅ HTML content verified serving correctly

## Client-Side Troubleshooting Steps

Since the VM services are confirmed working, the issue is on your client device. Follow these steps:

### Step 1: Verify Tailscale Client Status

On your device (laptop/phone/tablet), check Tailscale is connected:

```bash
# On macOS/Linux
tailscale status | grep graphdone-clean

# Expected output:
# 100.81.29.39  graphdone-clean  graphdone-clean.chocolate-perch.ts.net  linux  -
```

**Windows:** Check Tailscale system tray icon - should show green "Connected"

**Mobile:** Open Tailscale app - should show "Connected" with green indicator

### Step 2: Test Network Connectivity

```bash
# Ping the VM
ping 100.81.29.39

# Expected: 0% packet loss
```

If ping fails:
- Restart Tailscale on your device
- Check you're logged into the same Tailscale network (chocolate-perch)
- Verify your device shows as "Connected" in Tailscale admin console

### Step 3: Test HTTP Access

Try accessing via IP instead of hostname:

**Direct IP URLs:**
- Web UI: `http://100.81.29.39:3127`
- GraphQL: `http://100.81.29.39:4127/graphql`
- Neo4j: `http://100.81.29.39:7474`

**Hostname URLs:**
- Web UI: `http://graphdone-clean.chocolate-perch.ts.net:3127`
- GraphQL: `http://graphdone-clean.chocolate-perch.ts.net:4127/graphql`
- Neo4j: `http://graphdone-clean.chocolate-perch.ts.net:7474`

### Step 4: Browser-Specific Checks

**Chrome/Edge:**
- Check if browser is blocking "insecure content" (HTTP)
- Try in Incognito mode
- Check browser console (F12) for errors

**Firefox:**
- Enhanced Tracking Protection might block connections
- Try disabling shields for this site

**Safari:**
- Check "Prevent cross-site tracking" settings
- Try in Private Browsing mode

### Step 5: Firewall/Security Software

Check if your device has:
- Firewall blocking outbound connections to 100.81.29.39
- VPN software conflicting with Tailscale
- Corporate proxy/security software blocking access

### Step 6: Use curl for Testing

```bash
# Test from command line
curl -v http://100.81.29.39:3127

# Expected: HTTP 200 OK with HTML content
```

If curl works but browser doesn't:
- Browser extension blocking the connection
- Browser security settings too restrictive
- Try different browser

## Common Issues and Solutions

### Issue: "Site can't be reached" or "Connection refused"

**Solution 1:** Restart Tailscale on your device
```bash
# macOS/Linux
sudo tailscale down && sudo tailscale up

# Windows: Right-click Tailscale tray icon > Exit > Restart
```

**Solution 2:** Re-authenticate Tailscale
```bash
tailscale logout
tailscale login
```

### Issue: Ping works but HTTP doesn't

**Solution:** Your browser or firewall is blocking HTTP connections
- Try curl command (Step 6)
- Disable browser security extensions temporarily
- Check system firewall settings

### Issue: Works on one device but not another

**Solution:** Device-specific Tailscale configuration
- Ensure both devices are on same Tailscale network
- Check Tailscale ACLs in admin console
- Verify both devices show as "Connected"

## VM Information (For Reference)

```
Name:           graphdone-clean
State:          Running
IPv4:           10.205.93.235 (Multipass internal)
                100.81.29.39 (Tailscale)
Tailscale Host: graphdone-clean.chocolate-perch.ts.net
Node.js:        v20.19.5
Services:       All running and verified
Database:       Seeded with sample data
```

## Login Credentials

- **Admin**: `admin` / `graphdone`
- **Viewer**: `viewer` / `graphdone`

## Need More Help?

If none of the above works, run this diagnostic script on your device:

```bash
# Comprehensive diagnostic
echo "=== Tailscale Status ==="
tailscale status | grep graphdone-clean

echo -e "\n=== Ping Test ==="
ping -c 4 100.81.29.39

echo -e "\n=== HTTP Test ==="
curl -v http://100.81.29.39:3127 2>&1 | head -30

echo -e "\n=== DNS Resolution ==="
nslookup graphdone-clean.chocolate-perch.ts.net
```

Share the output for further troubleshooting.

---

**Last Verified:** 2025-11-13 17:35 PST
**VM Status:** All services operational and responding correctly
