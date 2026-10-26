# BTP Translator website on this Windows PC

The site in `website/` is separate from the desktop conversion engine. `node website/server.js` is the production server. It is not the Electron development server.

It serves the HAMDAN SYSTEMS page, the Windows installer, a health check, and a persistent download counter. Nothing in this setup changes DNS, the router, or the Windows Firewall by itself.

The intended public name is `btptranslator.linkpc.net`. That name is not connected to this PC until you complete the DNS and network steps below and confirm them yourself.

## 1. Build the installer

From the project folder:

```powershell
npm run dist
```

A successful build creates both of these files:

- `release/BTP-Translator-Setup.exe`
- `website/releases/BTP-Translator-Setup.exe`

The download button stays disabled while the second file is missing.

## 2. Start the website

Copy the example settings once:

```powershell
Copy-Item website\.env.example website\.env
```

`website/.env` is ignored by git. Leave `HOST=127.0.0.1` until you have decided to accept connections from other computers. Do not put a DNS Exit password or API key in this file.

Start:

```powershell
npm run website:start
```

Stop:

```powershell
npm run website:stop
```

The start command keeps the server running after the PowerShell window closes. It records the process number in `website/data/server.pid` and writes logs to `website/data/server.out.log` and `website/data/server.err.log`.

You can also run it in a window you can see:

```powershell
npm run website
```

Close that window, or press Ctrl+C, to stop that copy. Do not run both copies at the same time on the same port.

## 3. Settings

| Name | Purpose | Default |
| --- | --- | --- |
| `HOST` | Address the server accepts. `127.0.0.1` is this PC only. | `127.0.0.1` |
| `PORT` | Port on this PC | `4173` |
| `DATA_DIR` | Folder for `downloads.json` | `website/data` |
| `INSTALLER_PATH` | The real installer file | `website/releases/BTP-Translator-Setup.exe` |
| `DOWNLOAD_COOLDOWN_MS` | How long one browser is not counted again | `60000` |

The counter starts at zero when no counter file exists. It stores a hash of the address and browser, not the raw address. Opening or refreshing the page does not add a download. A second click inside the cooldown still downloads the file and does not add another count. If `downloads.json` is unreadable, the page shows `Downloads: unavailable` and the file is left unchanged.

`GET /health`, `GET /api/downloads`, and `GET /api/status` do not increment the counter. `GET /download?dl=1` sends the installer and records the request when the file exists. If the installer file is missing, the button is disabled and the route returns 404 without adding a count.

## 4. Test on this PC

With the server running and `HOST=127.0.0.1`:

1. Open `http://127.0.0.1:4173/`.
2. Open `http://127.0.0.1:4173/health`. It should say `"ok": true`.
3. Confirm the page shows **Download for Windows**, the version, install steps, and **Downloads**.
4. If the installer file exists, the button downloads `BTP-Translator-Setup.exe` and the count increases by one. Refresh the page and confirm the count does not increase again.
5. Click the button again within a minute. The file downloads again and the count stays the same.
6. Narrow the browser window and confirm the title, button, and counter still fit.

`http://127.0.0.1:4173/` is not `https://btptranslator.linkpc.net`. The local address works without DNS and without a certificate.

## 5. DNS Exit

`btptranslator.linkpc.net` has to point at the public address of this internet connection. Home addresses often change, so use DNS Exit dynamic DNS rather than typing an address into the project.

Do this in the DNS Exit website yourself. This project does not sign in, does not store your password, and does not change DNS records.

1. Sign in at [DNS Exit](https://dnsexit.com/).
2. Confirm the hostname `btptranslator.linkpc.net` exists in that account.
3. Open Dashboard, then Settings, and create an API key. DNS Exit's current update method uses that key. Their older username-and-password update address is a legacy option; use the API key for a new setup.
4. Keep the key in a password manager or in a Windows scheduled task that you create yourself. Do not paste it into this repository, `website/.env`, or a chat.

DNS Exit's current update request, from their dynamic DNS client page, is:

```text
curl https://api.dnsexit.com/dns/ud/?apikey=YOUR_API_KEY -d host=btptranslator.linkpc.net
```

Replace `YOUR_API_KEY` with the key from your account. DNS Exit reads the public address from the connection that sends the request. A code of `0` means the address was updated. A code of `1` means it was already current. Wait at least four minutes between updates, which is DNS Exit's stated limit.

On this PC you can run that command by hand after the address changes, or create a Windows scheduled task that runs it every 10 to 30 minutes. The official client list is at [DNS Exit dynamic DNS update clients](https://dnsexit.com/apps/dynamic-dns-update-clients/). Their Windows client is appropriate when you want a program instead of a scheduled `curl` command. Install and sign in to that client yourself.

Check the name before you try to open the site from the internet:

```powershell
nslookup btptranslator.linkpc.net
```

Compare the address it prints with the address shown by a "what is my IP" page in the browser. They should match. If `nslookup` fails or shows a different address, public visitors will not reach this PC. Fix DNS before changing the router.

## 6. HTTPS with Caddy

Caddy 2.11.7 is installed from the official Windows release at `tools/caddy/caddy.exe`. Its zip matched the SHA-512 digest in Caddy's official `caddy_2.11.7_checksums.txt`. It is not a Windows service and it does not start on its own.

The Node server stays on `127.0.0.1:4173`. That is the correct binding for this setup. Caddy runs on the same PC and connects to that address, so the Node process does not need `0.0.0.0`. Listening on every interface would offer plain HTTP on port 4173 to the local network and let visitors bypass HTTPS. Port 4173 is not forwarded. Node does not terminate HTTPS.

`website/Caddyfile` is the public configuration:

```text
btptranslator.linkpc.net {
	reverse_proxy 127.0.0.1:4173
}
```

When that file is started, Caddy listens on port 443, redirects port 80 to HTTPS, and requests a certificate for `btptranslator.linkpc.net`. Do not start it until the firewall and router items below are approved and applied. No certificate has been requested.

Check the configuration without listening or requesting a certificate:

```powershell
npm run caddy:validate
```

The local practice configuration, `website/Caddyfile.local`, proxies `http://127.0.0.1:8443` to the Node server. It does not use ports 80 or 443 and does not request a certificate.

```powershell
npm run website:start
npm run caddy:local
```

Leave that window open. In another window:

```powershell
curl.exe http://127.0.0.1:8443/health
```

Stop the local proxy with Ctrl+C. Stop the website with `npm run website:stop`.

After the network changes are in place, start the public proxy in a window and leave it open:

```powershell
npm run website:start
tools\caddy\caddy.exe run --config website\Caddyfile
```

Ctrl+C stops Caddy. `npm run website:stop` stops the website. Neither one restarts after Windows signs in or reboots. A service or sign-in task has not been created.

Caddy renews the certificate while that public process is running. Renewal also needs port 80 to remain reachable.

## 7. Router and firewall, only if you choose direct hosting

Do not put this PC in the router's DMZ. Do not turn the firewall off. Do not forward ports other than the ones the website needs.

The HSS project already uses this network's ports 80 and 443 for `hamdan1systems.linkpc.net`. Its documented router forwards are TCP 80 for certificate checks and TCP 443 for HSS. The existing router rules named ACME-HTTP and HSS-HTTPS must stay as they are. A home router forwards a port to one internal destination, so a second forward of 80 or 443 for BTP Translator would replace or compete with those rules. HSS also expects to listen on 443 itself when remote access is enabled. Caddy cannot take those ports while HSS is using them. Nothing in this project changes the HSS files, those router rules, or the firewall.

Windows already has inbound allows named `ACME HTTP Certificate Validation` on TCP 80 and `HSS HTTPS 443` on TCP 443. Two `caddy.exe` allows also exist for any TCP and UDP port on the Public profile. Those rules were left unchanged.

Direct hosting for this website still needs a plan that does not take HSS off ports 80 and 443. One safe shape, only after you approve it, is a single proxy that chooses the site by hostname: `btptranslator.linkpc.net` to `127.0.0.1:4173`, and `hamdan1systems.linkpc.net` left with HSS. That proxy is not configured or started.

These network changes have not been applied:

1. Reserve this PC's LAN address. It is `192.168.1.150` on Wi-Fi, MAC `94-E6-F7-84-5D-32`, and the router is `192.168.1.1`. In the router's DHCP or LAN settings, add an address reservation for that MAC so it always receives `192.168.1.150`. The current address came from DHCP and can change without this reservation.
2. Forward only these ports to `192.168.1.150`: external TCP 80 to port 80, and external TCP 443 to port 443. Do not forward port 4173. Do not enable DMZ.
3. Allow Caddy through Windows Firewall. The Wi-Fi network `Hammad-5G 2` is currently a Public network, so a Private-only rule would not match. The safer order is to classify that network as Private, then allow Caddy on the Private profile only:

```powershell
New-NetFirewallRule -DisplayName "BTP Translator Caddy" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80,443 -Program "C:\Users\hamda\Downloads\BTP TRANSLATOR\tools\caddy\caddy.exe" -Profile Private
```

4. Confirm `nslookup btptranslator.linkpc.net` still matches this connection's public address before starting `website/Caddyfile`.

A mobile phone on cellular data, not on the home Wi-Fi, is the right public test. Open `https://btptranslator.linkpc.net/health`. A result of `"ok": true` means an outside network reached this PC.

### When direct hosting cannot work

Compare the public address from a "what is my IP" page with the WAN address printed by the router. If they differ, or the WAN address is in `100.64.0.0` through `100.127.255.255`, `10.0.0.0` through `10.255.255.255`, `172.16.0.0` through `172.31.255.255`, or `192.168.0.0` through `192.168.255.255`, the connection is behind CGNAT or another private network. Port forwarding will not make the site reachable. Some ISPs also block inbound 80 and 443 even when the address is public.

DNS Exit documents the same limit: dynamic DNS does not fix CGNAT or blocked inbound ports. Their Remote Access tunnels are one paid option. A Cloudflare Tunnel is another. Either one keeps the Node server on `127.0.0.1` and does not require open router ports. Do not install a tunnel until you choose that route. This project has not opened one.

## 8. Keep it running after sign-in

The start script does not survive a restart by itself. After you sign in to Windows, run `npm run website:start` again.

A Task Scheduler task set to run at sign-in can do that for you. Create it only when you want that behavior. Do not install a Windows service unless you ask for one. A service is harder to see and stop.

If Caddy is installed, its own Windows service can start the HTTPS proxy. Leave that decision until the local HTTP site is already working.

## 9. Troubleshooting

| What you see | What to check |
| --- | --- |
| Download button is disabled | `website/releases/BTP-Translator-Setup.exe` is missing. Run `npm run dist`. |
| `Downloads: unavailable` | `website/data/downloads.json` is damaged. Do not delete it until you have a copy. Repair the JSON or move the damaged file aside. The server will not replace it with zero. |
| Port already in use | Another copy is running. Run `npm run website:stop`, then start once. |
| Server stops immediately | Read `website/data/server.err.log`. |
| `nslookup` does not show your public address | The dynamic update has not run, or it used the wrong hostname or key. |
| Certificate request fails | Port 80 is not reachable from the internet, or the hostname does not point here. |
| Phone on home Wi-Fi works, cellular does not | The phone is using the local network. Test again on cellular data. |
| Cellular also fails and the WAN address is private | Direct hosting is blocked by CGNAT or the ISP. Use an approved tunnel instead of more port forwards. |

The version in `website/release-info.json` must match `src/shared/version.ts`. The desktop tests check that.
