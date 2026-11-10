# Putting SHOPME on an AWS Ubuntu server

This guide follows **Option A** in `LAUNCH.md`: one server runs the shop at `https://your-domain`, the admin panel at `https://your-domain/admin` and the API.

How to read it:
- **🖱 Console:** you click something on a website (AWS, GitHub, your domain company).
- **⌨ Server:** you copy the grey box and paste it into the server's black terminal window, then press Enter. Paste one box at a time and wait until it finishes.
- Replace `shopme.in` everywhere with your real domain name.

The whole first setup takes about 2 hours. You can stop after any part and continue later.

---

## Part 0: What you need first

| Need | Why | Status |
|---|---|---|
| AWS account | The server | You have it |
| **Domain name** (e.g. shopme.in) | The site only starts in live mode with `https://`, which needs a domain | Needed before Part 9 |
| MongoDB Atlas account (free) | The online database | Part 3 |
| GitHub repository **set to Private** | The server downloads the code from there | See Part 5 |
| Cloudinary account (free) | Photos and backup copies online | Can be added later |
| Gmail App Password | Real emails | Can be added later |

**Cost:** a `t3.small` server in Mumbai with 20 GB of disk and a fixed address is about **₹1,600–2,000 a month**. A `t3.micro` (1 GB memory) is cheaper but too small to build the site comfortably.

---

## Part 1: Create the server (🖱 AWS console)

1. Log in at https://console.aws.amazon.com.
2. At the top right, pick the region **Asia Pacific (Mumbai) ap-south-1**.
3. Search **EC2** → **Launch instance**.
4. Fill in:
   - **Name:** `shopme`
   - **Application and OS Images:** **Ubuntu**, **Ubuntu Server 24.04 LTS** (64-bit x86)
   - **Instance type:** **t3.small**
   - **Key pair:** **Create new key pair** → name `shopme-key`, type **RSA**, format **.pem** → **Create**. A file `shopme-key.pem` downloads. **Keep it safe and never share it.** Whoever has it can log in to your server.
   - **Network settings → Edit:**
     - Allow **SSH** from **My IP**
     - Tick **Allow HTTPS traffic from the internet**
     - Tick **Allow HTTP traffic from the internet**
   - **Configure storage:** **20 GiB**, **gp3**
5. Click **Launch instance**.

### Give the server a fixed address
1. EC2 menu → **Network & Security → Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select the new address → **Actions → Associate Elastic IP address** → choose the `shopme` instance → **Associate**.
3. Write down this address (e.g. `13.233.10.20`). It's your **server address**.

---

## Part 2: Point your domain at the server (🖱 your domain company)

In the DNS settings of your domain (GoDaddy, Hostinger, BigRock…):

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| A | `@` | your server address | 600 (or default) |
| A | `www` | your server address | 600 (or default) |

Delete any old `A` record for `@` or `www` that points somewhere else (for example a "parked" page). Changes take from 10 minutes to a few hours to work.

---

## Part 3: Online database (🖱 MongoDB Atlas)

1. Sign up at https://www.mongodb.com/atlas → **Create** a cluster:
   - **M0 (Free)**, provider **AWS**, region **Mumbai (ap-south-1)**, name `shopme`.
2. **Database Access → Add New Database User:**
   - Username `shopme`, click **Autogenerate Secure Password**, copy it somewhere safe.
   - Role: **Read and write to any database**.
3. **Network Access → Add IP Address:** your **server address** (from Part 1), then **Confirm**.
4. **Database → Connect → Drivers:** copy the connection string. It looks like:
   `mongodb+srv://shopme:<password>@shopme.abcde.mongodb.net/?retryWrites=true&w=majority`
5. Put your password in place of `<password>` and add the database name `shopme` after `.net/`:
   `mongodb+srv://shopme:YOURPASSWORD@shopme.abcde.mongodb.net/shopme?retryWrites=true&w=majority`

That full line is your **MONGODB_URI**. Keep it private.

---

## Part 4: Open the server's terminal

**Easiest (no software):** EC2 → **Instances** → tick `shopme` → **Connect** → **EC2 Instance Connect** → **Connect**. A black terminal opens in the browser.

**Or from your Windows computer** (PowerShell):
```
ssh -i "C:\Users\admin\Downloads\shopme-key.pem" ubuntu@YOUR-SERVER-ADDRESS
```
Type `yes` the first time.

Every **⌨ Server** box below is typed in this terminal.

---

## Part 5: Prepare the server (⌨ Server)

### 5.1 Updates, time zone, firewall
```
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Kolkata
sudo apt -y install git nginx ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```
If it asks about restarting services, press Enter. If it says a restart is needed, run `sudo reboot`, wait a minute and connect again.

### 5.2 Extra memory (swap) so the build never runs out
```
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5.3 Node.js 24 and PM2 (keeps the site running)
```
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt -y install nodejs
sudo npm install -g pm2
node -v
```
The last line should show `v24…`.

---

## Part 6: Get the code (🖱 GitHub + ⌨ Server)

### 6.1 Make the repository private (🖱 GitHub), once
`github.com/RESHMA1415/website` → **Settings** → bottom of the page → **Change visibility** → **Make private**.

### 6.2 Give the server read-only access (⌨ Server, then 🖱 GitHub)
```
ssh-keygen -t ed25519 -C "shopme-server" -f ~/.ssh/github_shopme -N ""
cat ~/.ssh/github_shopme.pub
printf 'Host github.com\n  IdentityFile ~/.ssh/github_shopme\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```
Copy the line that starts with `ssh-ed25519`. On GitHub: the repository → **Settings → Deploy keys → Add deploy key** → title `shopme-server`, paste the line, **leave "Allow write access" unticked** → **Add key**.

### 6.3 The production branch
The server runs the **`production`** branch only. `production` is updated **only** by a reviewed pull request from `development` (owner's rule). Before the first install, the developer prepares that pull request; you approve and merge it on GitHub.

### 6.4 Download the code (⌨ Server)
```
sudo mkdir -p /var/www/shopme
sudo chown ubuntu:ubuntu /var/www/shopme
git clone -b production git@github.com:RESHMA1415/website.git /var/www/shopme
```
Type `yes` if it asks about github.com.

---

## Part 7: The private settings file (⌨ Server)

### 7.1 Make three long random secrets
```
for i in 1 2 3; do node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"; done
```
It prints three lines. Line 1 = `JWT_SECRET`, line 2 = `ADMIN_JWT_SECRET`, line 3 = `BACKUP_KEY`.
**Write `BACKUP_KEY` on paper and keep it locked away.** Without it, no backup can ever be opened.

### 7.2 Write the file
```
nano /var/www/shopme/backend/.env
```
Paste this, then fill in your values (keep everything on one line each, no spaces around `=`):
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://shopme:YOURPASSWORD@shopme.abcde.mongodb.net/shopme?retryWrites=true&w=majority

STORE_URL=https://shopme.in
ADMIN_URL=https://shopme.in/admin
CLIENT_URLS=https://shopme.in,https://www.shopme.in
STORE_DIST=../frontend/dist
ADMIN_DIST=../admin/dist
TRUST_PROXY=1

JWT_SECRET=PASTE-LINE-1
ADMIN_JWT_SECRET=PASTE-LINE-2

ADMIN_EMAIL=shopmesupport2@gmail.com
ADMIN_INITIAL_PASSWORD=ChooseAStrongPassword2026

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

EMAIL_FROM="SHOPME <shopmesupport2@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=shopmesupport2@gmail.com
SMTP_PASS=

CLOUDINARY_URL=
CLOUDINARY_FOLDER=shopme

BACKUP_KEY=PASTE-LINE-3
BACKUP_KEEP_DAYS=30
BACKUP_PATH=/var/www/shopme-data/backups
UPLOADS_PATH=/var/www/shopme-data/uploads
```
Save: **Ctrl+O**, **Enter**, then **Ctrl+X**.

Then lock the file and create the data folders:
```
chmod 600 /var/www/shopme/backend/.env
mkdir -p /var/www/shopme-data/backups /var/www/shopme-data/uploads
```

Notes:
- Empty Razorpay keys = the shop offers Cash on Delivery only. Add the **live** keys after Razorpay approves your KYC (`LAUNCH.md` 2.5).
- Empty `SMTP_PASS` = emails are only written to the log, until the Gmail App Password is ready.
- Empty `CLOUDINARY_URL` = photos are kept on this server in `/var/www/shopme-data/uploads` (fine to start; add Cloudinary later).
- The site refuses to start in live mode with `http://` addresses or short secrets. That's on purpose.

---

## Part 8: Install, build and start (⌨ Server)

```
cd /var/www/shopme
export MONGOMS_DISABLE_POSTINSTALL=1
npm run setup
npm run build:server
```
This takes 5–10 minutes. It ends with lines like `✓ built in …`.

Start the site and make it restart by itself after a reboot:
```
cd /var/www/shopme
pm2 start npm --name shopme -- start
pm2 save
pm2 startup
```
`pm2 startup` prints one line starting with `sudo env PATH=…`. **Copy that line, paste it and press Enter.**

Check it's running:
```
pm2 logs shopme --lines 30
```
You should see `Database connected` and `SHOPME API running`. Press **Ctrl+C** to leave the log.
```
curl -s http://127.0.0.1:5000/api/settings | head -c 200
```
It should print some text starting with `{`.

If it says **"Production settings need fixing"**, the lines below it say exactly which setting is wrong. Fix it with `nano /var/www/shopme/backend/.env`, then run `pm2 restart shopme`.

---

## Part 9: Connect the domain (⌨ Server)

### 9.1 Nginx (the front door)
```
sudo nano /etc/nginx/sites-available/shopme
```
Paste (change both domain names):
```
server {
    listen 80;
    server_name shopme.in www.shopme.in;
    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```
Save (**Ctrl+O**, **Enter**, **Ctrl+X**), then:
```
sudo ln -s /etc/nginx/sites-available/shopme /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
`nginx -t` must say `syntax is ok` and `test is successful`.

### 9.2 HTTPS (the padlock), free
Wait until your domain points at the server (Part 2). Check with `ping shopme.in`: it should show your server address. Then:
```
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d shopme.in -d www.shopme.in --redirect -m shopmesupport2@gmail.com --agree-tos -n
sudo certbot renew --dry-run
```
The certificate renews itself automatically.

---

## Part 10: First checks (🖱 browser)

1. Open **https://shopme.in**: the shop opens with the padlock.
2. Open **https://shopme.in/admin**: log in with `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`, then **change the password at once** (My Account → Change password).
3. A new database has the settings, policy pages and category menu, but **no products yet**. Your products from this computer are moved in Part 11.
4. Business Settings: check the store name, phone, WhatsApp number, charges.
5. My Account → Database backups → **Back up now**: it should say Saved.

---

## Part 11: Move your products and photos from this computer (developer)

The developer does this with you, once, before you announce the site:
1. On this computer: make a backup file of the development database, and zip the photos folder (`%LOCALAPPDATA%\shopme\uploads`).
2. Copy both to the server (`scp`), and unzip the photos into `/var/www/shopme-data/uploads`.
3. On the server: `pm2 stop shopme`, then `npm run restore -- <file> --check` and `npm run restore -- <file> --replace`, then `pm2 start shopme`.
4. Delete the test orders and the 6 sample products, and check the shop.

After the restore, the admin login is the one from this computer (the same email and the password you use here), because the admin account is copied too.

---

## Part 12: Updating the site later

Every change goes `development` → reviewed pull request → merged into `production` on GitHub. Then on the server:
```
cd /var/www/shopme
git pull
export MONGOMS_DISABLE_POSTINSTALL=1
npm run setup
npm run build:server
pm2 restart shopme
```

---

## When something goes wrong

| What you see | What to do |
|---|---|
| **502 Bad Gateway** | The site isn't running. `pm2 logs shopme --lines 50` shows why; fix, then `pm2 restart shopme`. |
| **"Production settings need fixing"** in the log | Fix the named setting in `backend/.env`, then `pm2 restart shopme`. |
| **Database connection error** | In Atlas, Network Access must list your server address, and the password in `MONGODB_URI` must be right. |
| Build stops with **"Killed"** | Not enough memory: check the swap from 5.2 is on (`free -h` shows Swap 2.0G). |
| **certbot** fails | The domain doesn't point at the server yet (Part 2). Wait and try again. |
| Upload of a video fails | Check `client_max_body_size 60m;` is in the Nginx file and run `sudo systemctl reload nginx`. |

Useful commands: `pm2 status` (is it running?), `pm2 restart shopme`, `pm2 logs shopme`, `sudo systemctl status nginx`.

**Security reminders:** never share `shopme-key.pem`, the `.env` file or the `BACKUP_KEY`. Keep SSH open only to "My IP" (EC2 → Security groups; update it if your home internet address changes).
