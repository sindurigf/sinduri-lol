---
title: 'Learning Discourse: A Hands-On Path for Admins'
date: 2026-10-30
category: 'open-source'
placeholder: true
tags: ['community']
teaser: 'I use Discourse every day for work. This is the learning path I wish I had when I started.'
readingTime: 34
---

I use Discourse every day for work.
This is the learning path I wish I had when I started.

It starts from zero.
If you have never set up Discourse, begin at Module 1 and work through the modules in order.

Each module has a goal, the steps and, where it helps, code you can copy.
The surprises I ran into are at the end of each module, in Watch Out, so the steps stay easy to follow.
Each one cost me some time.
I hope they save you some.

Discourse changes often.
Everything here was checked against Discourse as of October 2026.

## The Path at a Glance

| Stage                | Module                              | You will be able to                                                                                       |
| -------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Get started          | 1. Try Discourse                    | Explore a working site without any setup                                                                  |
| Get started          | 2. Set up your site                 | Run Discourse hosted or on your own server                                                                |
| Get started          | 3. Practice with test content       | Fill a test site with users and topics                                                                    |
| Build your community | 4. Basic settings                   | Configure sign-up, logins, email and staff security                                                       |
| Build your community | 5. Organize content and access      | Create categories, tags and groups, and understand trust levels                                           |
| Build your community | 6. Welcome and moderate             | Set up onboarding and handle flagged posts                                                                |
| Customize and extend | 7. Look and feel                    | Change styles with theme components                                                                       |
| Customize and extend | 8. Reports                          | Answer questions with SQL and share reports on a schedule                                                 |
| Customize and extend | 9. GitHub                           | Connect discussions with issues and pull requests                                                         |
| Customize and extend | 10. Discourse AI                    | Add summaries, spam detection and AI reports                                                              |
| Operate              | 11. Keep a self-hosted site running | Install plugins and keep a self-hosted site updated                                                       |
| Side path            | Move an existing site               | Keep links, analytics and consent working after a migration. Only if you are moving from another platform |

Some features, such as Data Explorer, Automation and AI, depend on your hosted plan.
Check the [pricing page](https://www.discourse.org/pricing) for details.
Module 11 and the server steps in Module 2 are only for self-hosted sites.

## Module 1: Try Discourse

**Goal:** see how Discourse works before you decide anything.

You can try Discourse without a server.
Start with a free trial or the Free plan.

### Steps

1. Go to [discourse.org/pricing](https://www.discourse.org/pricing) and start a trial or the Free plan. The page explains what each plan includes.
2. Follow the setup wizard. It asks for a site name, the site language, and who can see and join the site.
3. Create a topic, reply to it and like a post. This shows you Discourse the way members see it.
4. Open the admin area and look around. It is the Admin link in the sidebar, or `/admin`.
5. Invite one or two colleagues and try a conversation together.

By the end, you should know two things.
Does Discourse fit your needs?
Which features will you use?
Both help with the next decision.

### Watch Out

- **A trial and a plan are not the same thing.** A trial ends after a set time. Choose a plan before it ends if you want to keep the site.

## Module 2: Set Up Your Site

**Goal:** choose how to run Discourse and get your real site online.

### Choose Hosted or Self-Hosted

|               | Hosted by Discourse                       | Self-hosted                                          |
| ------------- | ----------------------------------------- | ---------------------------------------------------- |
| Updates       | Done for you                              | You run them                                         |
| Backups       | Done for you                              | You set them up                                      |
| Server access | None                                      | Full                                                 |
| Plugins       | Depend on your plan                       | Any plugin you install                               |
| Good fit for  | Teams that want to focus on the community | Teams with someone who can look after a Linux server |

If you are not sure, start hosted.
You can move to your own server later by restoring a backup.

### Path A: Hosted

1. Choose a plan before your trial ends. Compare plans on the pricing page. Some features are not on every plan.
2. If you want your own domain, such as `forum.example.com`, add the DNS record your host gives you. Then set the domain in your hosting dashboard.
3. Check that emails arrive. For example, invite yourself with a second address.
4. Continue with Module 3.

### Path B: Self-Hosted

**Before you start, you need:**

- A fresh 64-bit Linux server, ideally Ubuntu LTS. It needs at least 1 GB of RAM plus swap, and 2 GB or more is recommended. Swap is disk space the server uses as extra memory.
- Discourse uses ports 80 and 443, so do not run another website on the same server.
- Your own domain or subdomain pointing to the server, or the free `yoursite.discourse.diy` subdomain the installer offers. Discourse does not work on a bare IP address.
- An email provider that can send over SMTP, such as Postmark, Mailgun or Amazon SES. SMTP is the standard way servers send email. You can skip email at first and let people log in with Discourse ID. Most communities still need email for notifications.
- SSH access to the server as root.

**1. Connect to the server**

```bash
ssh root@your-server-ip
```

**2. Download and run the official installer**

Read a script before you run it as root:

```bash
wget -O install-discourse https://raw.githubusercontent.com/discourse/discourse_docker/main/install-discourse
less install-discourse
sudo bash install-discourse
```

The installer sets up Docker and git.
It puts the official setup files in `/var/discourse`.
Then it starts the setup wizard.

**3. Answer the setup wizard**

It asks for your admin email address and your domain, or a free subdomain.
It can also ask for your email settings. These are optional.
It saves the answers in `/var/discourse/containers/app.yml`.
That file holds your site's configuration and secrets.
Then it builds the site, which takes a few minutes.
HTTPS certificates from Let's Encrypt are set up for you.

**4. Create your admin account**

Open your domain in a browser.
Register with the admin email you entered.
The setup wizard from Module 1 opens next.

**5. Turn on basic protection**

The official install guide recommends these two commands:

```bash
dpkg-reconfigure -plow unattended-upgrades   # automatic security updates
apt install fail2ban                          # blocks repeated failed logins
```

The next two steps cover SSH keys, the firewall and backups.
Do them before you invite members.
Module 11 covers updates.

**6. Secure server access**

1. Add your SSH public key to the server. Check that you can log in with it.
2. Turn off password login. In `/etc/ssh/sshd_config`, set `PasswordAuthentication no`. Also check the files in `/etc/ssh/sshd_config.d/`, because a file there can turn password login back on.
3. Check the configuration and restart SSH. Keep your current session open, and test a new one before you log out:

```bash
sshd -t && systemctl restart ssh
```

4. Keep automatic security updates and fail2ban running (Path B, step 5).
5. Use your cloud provider's firewall to allow only ports 22, 80 and 443. If you can, limit port 22 to your own IP address. Port 80 must stay open, because Let's Encrypt uses it to renew certificates.

**7. Set up automatic backups**

Search the settings for `backup`:

| Setting               | Recommended value                                           |
| --------------------- | ----------------------------------------------------------- |
| `backup frequency`    | `1` (daily). The default is 7 days, and 0 turns backups off |
| `backup with uploads` | On, so images and files are included                        |
| `maximum backups`     | How many to keep, for example 7                             |
| `backup location`     | S3, so backups are stored off the server                    |

Store backups in their own S3-compatible bucket.
S3 is Amazon's file storage service, and many other providers offer the same interface.
AWS S3, Backblaze B2 and Wasabi all work, among others.
Never use the same bucket and folder as uploads.

You can set this in the admin settings (`s3 backup bucket`, `s3 access key id`, `s3 secret access key`, `s3 region`).
You can also set it in `app.yml`:

```yaml
env:
  DISCOURSE_BACKUP_LOCATION: s3
  DISCOURSE_S3_REGION: eu-central-1
  DISCOURSE_S3_ACCESS_KEY_ID: your-access-key
  DISCOURSE_S3_SECRET_ACCESS_KEY: your-secret-key
  DISCOURSE_S3_BACKUP_BUCKET: my-discourse-backups/main
  # Only for providers other than AWS, for example:
  # DISCOURSE_S3_ENDPOINT: https://s3.eu-central-003.backblazeb2.com
```

Changes to `app.yml` take effect after a rebuild (see Keep Discourse Updated in Module 11).

Then:

- Give the storage key access to the backup bucket only.
- Turn on versioning or object lock for the bucket. Versioning keeps older copies of each file. Object lock stops files from being deleted for a set time. Then backups cannot be deleted if the server is compromised.
- Keep an encrypted copy of `/var/discourse/containers/app.yml` somewhere safe. It holds your configuration and secrets.
- Restore a backup on a fresh server at least once. A backup you have never restored is not a tested backup.

### Watch Out

- **Re-running the installer resets the setup files.** It overwrites local changes in `/var/discourse`. It does not touch your `containers/app.yml` or your data. Keep your own changes in `app.yml`.
- **Docker can bypass a ufw firewall.** ufw is the firewall tool that ships with Ubuntu. Docker opens its ports directly, so a ufw rule may not block them. Use your cloud provider's firewall instead.
- **Password login can come back.** On some cloud images, a file in `/etc/ssh/sshd_config.d/` sets `PasswordAuthentication yes`. It overrides your main config. Check that folder too.

## Module 3: Practice with Test Content

**Goal:** have a second site with realistic content, so you can try the next modules without affecting real members.

Never add test content to your live site.
Test posts send notifications, award badges and show up in your analytics.

Use a separate site for this, such as a second trial or a staging server.

### On a Hosted Site

There is no server access, so use the API.
Create an API key with the **topics: write** scope.
A scope limits what a key can do.
Module 5 explains API keys in more detail.

The script needs `curl` and `jq`.

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${DISCOURSE_URL:?Set DISCOURSE_URL}"
: "${DISCOURSE_API_KEY:?Set DISCOURSE_API_KEY}"
: "${DISCOURSE_API_USERNAME:?Set DISCOURSE_API_USERNAME}"
CATEGORY_ID="${CATEGORY_ID:-5}"

for i in 1 2 3; do
  payload=$(jq -n \
    --arg title "Test topic number $i with some example content" \
    --arg raw "This is seed content for test topic $i, written $(date -u +%FT%T)." \
    --argjson category "$CATEGORY_ID" \
    '{title: $title, raw: $raw, category: $category}')

  curl -sS --fail-with-body --max-time 30 \
    -X POST "$DISCOURSE_URL/posts.json" \
    -H "Api-Key: $DISCOURSE_API_KEY" \
    -H "Api-Username: $DISCOURSE_API_USERNAME" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq '{topic_id, topic_slug}'

  sleep 2   # stay well under the admin API limit of 60 requests a minute
done
```

Building the JSON with `jq` avoids broken quotes when titles contain special characters.
Set `DISCOURSE_API_USERNAME` to the user the key belongs to.
Run it once. A second run fails, because topic titles must be unique.

### On a Self-Hosted Server

Open the Rails console.
It is a command line inside your running Discourse site, where you can run Ruby code:

```bash
cd /var/discourse
./launcher enter app
rails c
```

Then paste this script.
It creates two categories, five users and three topics with replies.
It turns off rate limits only for this console session.
Run it once. A second run stops with a duplicate title error, unless you change the titles.

```ruby
RateLimiter.disable
begin
  cat = Category.find_or_create_by!(name: "Test Category") do |c|
    c.user = Discourse.system_user
    c.color = "0088CC"
  end

  sub = Category.find_or_create_by!(name: "Test Subcategory", parent_category_id: cat.id) do |c|
    c.user = Discourse.system_user
    c.color = "3AB54A"
  end

  users = 5.times.map do |i|
    User.find_by(username: "testuser#{i}") ||
      User.create!(username: "testuser#{i}", email: "testuser#{i}@example.invalid",
                   password: SecureRandom.hex(16), active: true, approved: true,
                   trust_level: 1)
  end

  3.times do |i|
    post = PostCreator.create!(users.sample,
                               title: "Test topic #{i} with some example content",
                               raw: "Seed content for test topic #{i}.",
                               category: sub.id,
                               skip_rate_limits: true)
    2.times do |j|
      PostCreator.create!(users.sample,
                          topic_id: post.topic_id,
                          raw: "Test reply #{j} on topic #{i} with enough text.",
                          skip_rate_limits: true)
    end
  end
ensure
  RateLimiter.enable
end
```

Each reply has different text.
Discourse rejects the same text from the same person within five minutes.

### On a Local Development Install

If you work on Discourse code locally, built-in tasks fill the database for you:

```bash
bin/rails dev:populate   # adds groups, users, categories, tags, topics and replies
bin/rails dev:reset      # wipes the database, rebuilds it, then populates
```

Both are meant for development.
`dev:reset` refuses to run outside development.
`dev:populate` refuses to run in production unless you deliberately allow it.

### Watch Out

- **Data Explorer cannot create data.** Data Explorer (Module 8) runs read-only queries. It is a reporting tool, not a seeding tool.
- **Rate limits apply in the console too.** New users can post only every thirty seconds. The same text from the same person within five minutes is rejected. The seed script handles both.
- **Raw SQL inserts break things.** Going through `PostCreator` and `User` keeps counters, search and category stats correct.
- **Use the `.invalid` domain for test emails.** It can never receive mail, so no real person gets a notification.

## Module 4: Basic Settings

**Goal:** make the site yours and decide who can join, before anyone else arrives.

Settings live in the admin area.
The fastest way to find one is the settings search.
Type part of the name, such as `login required`.

### 1. Name and Branding

- Set the site title and a short description. Both appear in search results and link previews.
- Upload a logo, a small logo for when the header is compact, an optional mobile logo and a favicon.
- Set `contact email` to an address your team checks. Members who need help see it.

### 2. Who Can Join

| What you want                                | Settings to change           |
| -------------------------------------------- | ---------------------------- |
| Anyone can read and sign up                  | Leave the defaults           |
| Anyone can read, but you approve new members | Turn on `must approve users` |
| Only signed-in members can read              | Turn on `login required`     |
| People join only through invites             | Turn on `invite only`        |

### 3. Login Options

| Login option                                           | Setting to search for         |
| ------------------------------------------------------ | ----------------------------- |
| Email and password                                     | On by default                 |
| Google                                                 | `enable google oauth2 logins` |
| GitHub                                                 | `enable github logins`        |
| Single sign-on with your own system (DiscourseConnect) | `enable discourse connect`    |
| Discourse ID                                           | `enable discourse id`         |

Other providers, such as Facebook, Discord and LinkedIn, work the same way.
For a company identity provider that uses OpenID Connect, use the bundled OpenID Connect plugin.

### 4. Email

- Set `notification email` to the address emails are sent from.
- Send yourself a test email from the Email page in the admin area.
- Check that your domain has SPF and DKIM records. These DNS records tell other mail servers that your emails are genuine, so they do not land in spam.

### 5. Staff Security

- Set `enforce second factor` to **staff**. Then every admin and moderator must use two-factor authentication. Choose **all** to require it for everyone.
- Give admin access only to people who need it. Most helpers only need moderator access.

### Watch Out

- **Email problems look like login problems.** If new accounts never get their activation email, check your SMTP settings and your domain's SPF and DKIM records first.

## Module 5: Organize Content and Access

**Goal:** set up a structure people can find their way around, with the right access for each group.

### The Building Blocks

- **Categories and subcategories** hold topics. Each one has its own description and permissions.
- **Tags** label topics across categories, for example a product version or an event year. Tags are on by default.
- **Groups** collect people. Permissions and category moderation are given to groups, not to single people.
- **Staff roles:** admins can change everything. Moderators can moderate the whole site. Category moderators manage only the categories they are given.

### Steps

1. Sketch your structure on paper first. A few broad categories with tags usually work better than many small categories.
2. Create categories from the Categories page with **New Category**. Give each one a clear name, a one-line description and a color.
3. Create a few tags to start with.
4. Create groups in the admin area under Groups. For example, create one per team or audience.
5. Open each category's **Security** tab. Choose which groups can see it, reply to topics in it or create topics in it.
6. To let a group manage a category, turn on `enable category group moderation`. Then add the group as a moderating group in that category's settings. You can add more than one group.

Members of a moderating group can do these things in that category, without access to the admin area:

- edit the category description
- pin, close, archive and move topics
- edit or delete posts
- handle flags

### How Trust Levels Work

Discourse gives members more abilities as they take part.
You do not have to manage this by hand.

| Level | Name    | How members reach it               | Examples of what it unlocks                                  |
| ----- | ------- | ---------------------------------- | ------------------------------------------------------------ |
| 0     | New     | Signing up                         | Posting, with limits on links, images and replies            |
| 1     | Basic   | Reading a few topics               | More links and images, file attachments and private messages |
| 2     | Member  | Visiting and reading regularly     | Inviting others, fewer limits                                |
| 3     | Regular | Steady activity over recent months | Renaming and recategorizing topics                           |
| 4     | Leader  | Promoted by staff                  | Editing posts and moderating topics across the site          |

The requirements are site settings that start with `tl1 requires`, `tl2 requires` and `tl3 requires`.
The defaults work for most communities.

### About API Keys

An API key lets a script act on your site.
Create API keys in the admin area under Advanced > API keys.

- Set the user level to **Single User** and pick the user the key acts as.
- Choose the narrowest scope that works. A granular scope allows only certain actions, such as creating topics. A global scope allows everything.
- Creating categories has no narrow scope. It needs a key with global scope. Create that key for the task and revoke it afterward.
- Store keys in a password manager or environment variables. Never put them in chats, shared documents or code repositories.

### Code: Create a Private Category with the API

This is useful when you set up many categories at once.
Only `name` is required.
Set `DISCOURSE_API_USERNAME` to the user the key belongs to.
Permissions map an existing group's name to a number:

- `1`: create, reply and see
- `2`: reply and see
- `3`: see only

```bash
curl -sS --fail-with-body -X POST "$DISCOURSE_URL/categories.json" \
  -H "Api-Key: $DISCOURSE_API_KEY" \
  -H "Api-Username: $DISCOURSE_API_USERNAME" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "Working Group",
        "color": "0088CC",
        "text_color": "FFFFFF",
        "permissions": { "working-group": 1, "staff": 1 }
      }'
```

Running it twice gives an error, because the name already exists.
If you script this, check the category list first.

### Watch Out

- **Removing "everyone" from a category also hides it from search engines.** Only do this for content that is meant to be private.
- **Category moderation is given to groups, not people.** If only one person should moderate a category, create a small group for them.
- **Changing permissions on a busy category stops notifications silently.** People who lose access stop getting updates, and nobody tells them. Announce changes first.
- **Some API actions have no narrow scope.** Creating categories and changing site texts need a key with global scope. Create one for the task and revoke it afterward.

## Module 6: Welcome and Moderate

**Goal:** help new members find their way, and know what to do when something goes wrong.

### 1. Write Your Guidelines

Discourse creates a FAQ and guidelines page for you.
Edit it to fit your community:

- what the site is for
- how to behave
- how to report a problem
- how moderators respond

Tell people how to report content: flag the post, or send a message to `@moderators`.

### 2. Write a Welcome Topic

Edit the pinned welcome topic.
It should explain where to start, which categories to post in and how to find answers.

### 3. Set Up the Narrative Bot

Discourse ships with a narrative bot called discobot.
It sends new members a private message with an interactive tutorial.
The tutorial covers bookmarking, link previews, emoji, mentions, formatting, quoting, images, likes, flagging and search.
Finishing it earns the **Certified** badge.
An advanced tutorial covers editing, deleting, polls and more, and earns the **Licensed** badge.

1. Find the setting `disable discourse narrative bot welcome post` and **uncheck** it. It is checked by default on new sites, and since August 2025 on most existing sites too. So new members do not get the tutorial automatically. Members can still start it with `@discobot start new user`.
2. In the admin area, go to Appearance > Site texts. Search for `discourse_narrative_bot` to see all its messages.
3. Rewrite the messages in your community's voice, with links to your own categories and guidelines. You can change the wording, not the steps.
4. Create a new account through an invite link. Go through the tutorial the way a real new member would.

### 4. Handle Flags and the Review Queue

Flagged posts go to the review queue.
So do posts that Discourse holds for approval.
Staff find it under **Review** in the sidebar, or at `/review`.

1. For each item, decide what to do. You can approve it, edit it, hide or delete the post, or take action on the member.
2. For a member who keeps causing problems, start with a private message. If that does not help, **silence** or **suspend** them for a set time. Silenced members can read but not post. Suspended members cannot log in.
3. Check the queue daily while your community is new. Members notice quickly when flags are ignored.

### Code: Change Many Site Texts with the API

Rewriting the bot can mean over a hundred messages.
Keep them in a JSON file and apply them with a script.
This is faster, easy to review and easy to repeat on another site.

Changing site texts needs a key with global scope.
Create one just for this and revoke it when you are done.

`texts.json`:

```json
{
  "discourse_narrative_bot.new_user_narrative.hello.message": "Welcome to %{title}! Your new text here, with a link to %{base_uri}/guidelines."
}
```

Keep every placeholder in `%{...}` that the original text uses.
Each message has its own set, so copy them from the original before you edit.

`apply_texts.py`:

```python
import json
import os
import time

import requests

URL = os.environ["DISCOURSE_URL"].rstrip("/")
HEADERS = {
    "Api-Key": os.environ["DISCOURSE_API_KEY"],
    "Api-Username": os.environ.get("DISCOURSE_API_USERNAME", "system"),
}

def retry_after(response, default=10):
    """Seconds to wait after a 429 response."""
    try:
        return int(response.headers.get("Retry-After", default))
    except ValueError:
        return default

def put_text(session, key, value, retries=3):
    """Update one site text, waiting and retrying if rate limited."""
    for _ in range(retries):
        response = session.put(
            f"{URL}/admin/customize/site_texts/{key}.json",
            data={"site_text[value]": value, "site_text[locale]": "en"},
            timeout=30,
        )
        if response.status_code != 429:
            return response
        time.sleep(retry_after(response))
    return response

def main():
    with open("texts.json", encoding="utf-8") as f:
        texts = json.load(f)

    failed = []
    with requests.Session() as session:
        session.headers.update(HEADERS)
        for key, value in texts.items():
            response = put_text(session, key, value)
            if response.ok:
                print(f"OK      {key}")
            else:
                print(f"FAILED  {key}: {response.status_code} {response.text[:200]}")
                failed.append(key)
            time.sleep(1.2)  # the admin API allows about 60 requests a minute

    print(f"\nDone. {len(texts) - len(failed)} updated, {len(failed)} failed.")

if __name__ == "__main__":
    main()
```

Run it on a test site first, then on your live site:

```bash
pip install requests
export DISCOURSE_URL="https://forum.example.com"
export DISCOURSE_API_KEY="..."   # paste the key here, do not save it in the file
python3 apply_texts.py
```

### Watch Out

- **The tutorial is off by default.** This is true on new sites, and since August 2025 on most existing sites. `disable discourse narrative bot welcome post` starts checked. New members do not get the tutorial automatically until you uncheck it.
- **You can change what the bot says, not what it teaches.** New steps need a custom plugin. On hosted sites, custom plugins depend on your plan.
- **Placeholders differ between messages.** The welcome message uses `%{title}` and `%{base_uri}`. Other messages use `%{username}`. Discourse rejects a placeholder the original does not have. Removing one drops that value from the message.

## Module 7: Look and Feel

**Goal:** change how the site looks in a way that survives updates and works in light and dark mode.

### Steps

1. In the admin area, go to Appearance > Themes and components. Create a new **component**. Do not edit a theme's own code. The built-in themes cannot be edited, and updates overwrite changes to installed themes.
2. Add the component to your active theme.
3. Open the component's code editor. Styles go in the CSS tabs, and SCSS works there. JavaScript goes in the JS tab.
4. Test every change in light and dark mode, logged in and logged out, on desktop and mobile.

### Code: Link Colors That Work in Light and Dark Mode

Colors written directly in `common.scss` are fixed when the stylesheet is built.
They do not switch when a member's device moves to dark mode.

Define colors as CSS variables in the **Color Definitions** tab (`color_definitions.scss`) instead.
That file is built once for each color scheme.

`color_definitions.scss`:

```scss
:root {
  --topic-link: #{dark-light-choose(#0056b3, #66b3ff)};
  --topic-link-visited: #{dark-light-choose(#5a2d91, #c8a2ff)};
}
```

`common.scss`:

```scss
.topic-list-item .main-link a.title:not(.badge-notification) {
  color: var(--topic-link);
}

// Discourse adds a .visited class to the row of a topic you have read
.topic-list-item.visited .main-link a.title:not(.badge-notification) {
  color: var(--topic-link-visited);
}
```

Each color passes the 4.5:1 contrast ratio for normal text on its own background.
The light colors reach at least 7:1 on white.
The dark ones reach at least 7:1 on Discourse's dark backgrounds.
Check your own colors with a contrast checker.

If you only want the color scheme's own link color, use `var(--tertiary)`.
It already switches correctly.

### Code: Show Something Only to Visitors

Discourse adds the class `anon` to the `<html>` element for visitors who are not logged in.
So you do not need JavaScript for this.
For example, this hides a banner from logged-in members:

```scss
html:not(.anon) .my-banner {
  display: none;
}
```

Reach for JavaScript only when CSS cannot do the job.
The theme developer guides on meta.discourse.org cover the plugin API.

### Watch Out

- **SCSS color functions do not follow dark mode.** `dark-light-choose` in `common.scss` is decided when the stylesheet is built. Use CSS variables from `color_definitions.scss`, or the built-in color variables.
- **Browser `:visited` does not match how Discourse tracks reading.** Discourse adds a `.visited` class to the row of each topic you have read. Style `.topic-list-item.visited`. Logged-out visitors still get the browser's `:visited`.
- **Class names in third-party components change between versions.** Inspect the current class names in your browser tools before you target them.

## Module 8: Reports with Data Explorer and Automation

**Goal:** answer questions about your site with SQL, and share the answers on a schedule.

Data Explorer and Automation are both bundled with Discourse.
On hosted sites, check that your plan includes them.

### Step 1: Turn On Data Explorer

Search the settings for `data explorer enabled` and turn it on.
Then open Data Explorer from the Plugins page in the admin area.

### Step 2: Write a Query with Parameters

Parameters go in a comment block at the top of the query.
They show up as fields above the results.
That way the same query works for any category or date range.

Useful types include `string`, `int`, `date`, `user_id` and `category_id`.
`category_id` gives you a category picker.

This query lists posts that still link to an old address.
It is handy after a migration:

```sql
-- [params]
-- string :domain = https://old.example.com

SELECT
  p.id AS post_id,
  t.title AS topic_title,
  u.username,
  CONCAT('/t/', t.slug, '/', t.id, '/', p.post_number) AS post_url
FROM posts p
JOIN topics t ON t.id = p.topic_id
JOIN users u ON u.id = p.user_id
WHERE p.raw ILIKE '%' || :domain || '%'
  AND p.deleted_at IS NULL
  AND t.deleted_at IS NULL
ORDER BY p.created_at DESC
```

This one builds a monthly leaderboard of replies in one category:

```sql
-- [params]
-- category_id :category_id
-- date :start_date
-- date :end_date

SELECT
  u.username,
  COUNT(*) AS replies
FROM posts p
JOIN topics t ON t.id = p.topic_id
JOIN users u ON u.id = p.user_id
WHERE t.category_id = :category_id
  AND p.post_number > 1
  AND p.created_at >= :start_date
  AND p.created_at < :end_date
  AND p.deleted_at IS NULL
  AND p.user_id > 0   -- leaves out system and bot accounts
GROUP BY u.username
ORDER BY replies DESC
LIMIT 10
```

Save each query.
Its ID is the number in the page address.

### Step 3: Share Results on a Schedule

In the admin area, open Automation from the Plugins page.
Create a new automation with one of these scripts:

| Script                                                | What it does                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Schedule a PM with Data Explorer results              | Sends the results as a private message to people or groups                |
| Schedule a post in a topic with Data Explorer results | Posts the results as a reply in a topic, for example a pinned leaderboard |

1. Choose the **Recurring** trigger.
2. Pick the query and fill in its parameters.
3. Set how often it runs, for example every month.

Parameters you fill in here stay the same on every run. So a monthly report would repeat the same dates. For a monthly leaderboard, work out the dates in the SQL instead.

Both scripts can attach the results as a CSV file. This needs `csv` in the `authorized extensions` setting.
Both can also skip posting when there are no results.

### Optional: Run a Query from Your Own Code

For reports outside Discourse, such as a spreadsheet or dashboard, run the query through the API.
Create a key with the **Data Explorer: run queries** scope.

```python
import json
import os

import requests

URL = os.environ["DISCOURSE_URL"].rstrip("/")
HEADERS = {
    "Api-Key": os.environ["DISCOURSE_API_KEY"],
    "Api-Username": os.environ.get("DISCOURSE_API_USERNAME", "system"),
}
QUERY_ID = os.environ["QUERY_ID"]

# Parameter values are always sent as strings
params = {"category_id": "12", "start_date": "2026-10-01", "end_date": "2026-11-01"}

response = requests.post(
    f"{URL}/admin/plugins/discourse-data-explorer/queries/{QUERY_ID}/run.json",
    headers=HEADERS,
    data={"params": json.dumps(params)},
    timeout=60,
)

try:
    result = response.json()
except ValueError:
    raise SystemExit(f"Unexpected response ({response.status_code}): {response.text[:200]}")

if not response.ok or not result.get("success"):
    raise SystemExit(f"Query failed: {result.get('errors')}")

print(result["columns"])
for row in result["rows"]:   # each row is a list, in column order
    print(row)
```

The API returns up to 1,000 rows by default.

### Watch Out

- **Data Explorer can see everything.** That includes private categories, private messages and email addresses. Only admins and trusted groups should have access. Shared results should never include personal data.
- **There is no "last day of the month" schedule.** A monthly automation repeats on the day of its start date. Run monthly reports on the 1st, for the previous month.
- **`@username` in a posted report notifies people.** Leave out the `@` if you do not want members pinged every month.

## Module 9: GitHub Integration

**Goal:** connect discussions and code, so people can move between a GitHub issue or pull request and the conversation about it.

The GitHub integration is part of Discourse core.
There is nothing to install.
On hosted sites, check that your plan includes it.
It has four features, each with its own setting:

| Feature             | What it does                                                        | Setting                     | GitHub token needed                       |
| ------------------- | ------------------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| Badges              | Awards badges for commits to the repos you list                     | `github badges enabled`     | A token with no scopes                    |
| Linkback            | Comments on a pull request, issue or commit when a post links to it | `github linkback enabled`   | `public_repo`                             |
| Permalinks          | Replaces links to GitHub files with permanent links                 | `github permalinks enabled` | None                                      |
| Pull request status | Shows a live status icon on pull request previews                   | `github pr status enabled`  | None for public repos, `repo` for private |

### Step 1: Turn On the Features

1. Create a GitHub personal access token (classic) with only the scope you need. The `public_repo` scope can write to repositories. So create the token from a separate GitHub account that has access to nothing important.
2. In the settings, search for `github`. Turn on `enable discourse github plugin` first. It is off by default. Then turn on the features you want. Paste the token into `github linkback access token`.
3. List your repositories in `github linkback projects`, as `owner/repo`. Also list them in `github badges repos`.
4. For pull request status on private repos, add tokens to `github onebox access tokens`. Add one per line, as `organization|token`.
5. Test it: post a link to a pull request in a topic.

### Step 2: Set Up Live Pull Request Status

A webhook lets GitHub tell Discourse when a pull request changes.
Generate a secret and save it in the `github webhook secret` setting:

```bash
openssl rand -hex 32
```

Then add a webhook in GitHub, under the repository's or organization's Settings > Webhooks:

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Payload URL  | `https://forum.example.com/discourse-github/webhooks/github` |
| Content type | `application/json`                                           |
| Secret       | The value you generated                                      |
| Events       | Pull requests, and Pull request reviews                      |

### Code: Turn New Issues Into Discourse Topics

This GitHub Action creates a Discourse topic for every new issue.
Then it comments on the issue with the link.
Save it as `.github/workflows/issue-to-discourse.yml`.

```yaml
name: Issue to Discourse

on:
  issues:
    types: [opened]

permissions:
  issues: write

concurrency:
  group: issue-to-discourse-${{ github.event.issue.number }}

jobs:
  create-topic:
    # Do not copy issues from private repos to a public forum
    if: ${{ !github.event.repository.private }}
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Create Discourse topic
        id: topic
        env:
          DISCOURSE_URL: ${{ vars.DISCOURSE_URL }}
          CATEGORY_ID: ${{ vars.DISCOURSE_CATEGORY_ID }}
          API_USERNAME: ${{ vars.DISCOURSE_API_USERNAME }}
          API_KEY: ${{ secrets.DISCOURSE_API_KEY }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_URL: ${{ github.event.issue.html_url }}
        run: |
          body="${ISSUE_BODY:-No description provided.}"
          payload=$(jq -n \
            --arg title "GitHub issue #$ISSUE_NUMBER: $ISSUE_TITLE" \
            --arg raw "$body"$'\n\n'"Original issue: $ISSUE_URL" \
            --argjson category "$CATEGORY_ID" \
            '{title: $title, raw: $raw, category: $category}')

          response=$(curl -sS --fail-with-body --max-time 30 \
            -X POST "$DISCOURSE_URL/posts.json" \
            -H "Api-Key: $API_KEY" \
            -H "Api-Username: $API_USERNAME" \
            -H "Content-Type: application/json" \
            -d "$payload")

          topic_id=$(echo "$response" | jq -r '.topic_id // empty')
          slug=$(echo "$response" | jq -r '.topic_slug // empty')
          if [ -z "$topic_id" ]; then
            echo "::error::Discourse did not return a topic: $response"
            exit 1
          fi
          echo "url=$DISCOURSE_URL/t/$slug/$topic_id" >> "$GITHUB_OUTPUT"

      - name: Comment on the issue
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          TOPIC_URL: ${{ steps.topic.outputs.url }}
        run: |
          gh issue comment "$ISSUE_NUMBER" --repo "$REPO" \
            --body "Discussion on Discourse: $TOPIC_URL"
```

To set it up:

1. In Discourse, create a single-user API key for a dedicated bot account. Give it the granular scope **topics: write** only. That scope covers creating topics and replies.
2. In the GitHub repository, go to Settings > Secrets and variables > Actions.
3. Add `DISCOURSE_API_KEY` as a **secret**.
4. Add `DISCOURSE_URL`, `DISCOURSE_CATEGORY_ID` and `DISCOURSE_API_USERNAME` as **variables**. They are not secret, so they do not need to be hidden.

All issue text goes through environment variables and `jq`.
It is never written straight into the script.
This follows GitHub's guidance on preventing script injection.
That matters here, because anyone can open an issue.

### Watch Out

- **The webhook needs a public site.** GitHub cannot reach localhost, so live pull request status will not update there. The other features still work.
- **Short issue titles can fail.** Discourse has a minimum title length of fifteen characters. That is why the Action adds the issue number as a prefix.
- **You may sometimes get two links on an issue.** Linkback skips issues that already link to the topic. But if it runs before the Action comments, both comments appear.
- **Mentions travel.** An `@name` in an issue body notifies the Discourse user with that username.
- **Live status replaces an older theme component.** If you used the GitHub Status theme component, remove it first. The two do not work together.

## Module 10: Discourse AI

**Goal:** connect a language model to Discourse and use it for summaries, spam detection, writing help and staff reports.

Discourse AI is bundled with Discourse.
Hosted plans include daily AI credits and a Discourse-hosted model.
So you can start without your own provider.
To use your own provider, follow these steps.

### Step 1: Get an API Key from a Provider

Create a separate key just for Discourse.
Set a monthly spend limit with your provider.

Chat subscriptions, such as Claude.ai Pro, do not include API access.
API usage is set up and billed separately.

Also read your provider's terms on how API data is stored and used.

### Step 2: Add the Model

1. In the admin area, open the AI plugin and go to **LLMs**. Add a model. Templates for common models fill in most fields.
2. Check the model ID against your provider's current model list. For example, a small Anthropic model:

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Provider | Anthropic                                 |
| Model ID | `claude-haiku-5-5`                        |
| URL      | `https://api.anthropic.com/v1/messages`   |
| API key  | Your dedicated key                        |
| Images   | Turn on if the model supports image input |

3. Click **Run test**. Save only when the test passes.

### Step 3: Make It the Default

Set `ai default llm model` to your new model.
Then open each agent in the AI plugin and check which model it uses.
An agent is an AI bot you set up with its own prompt and model.
Agents with a model set explicitly do not follow the default.

### Step 4: Turn On Features One at a Time

| Feature                      | Setting                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| Topic summaries              | `ai summarization enabled`                                          |
| Spam detection               | `ai spam detection enabled`                                         |
| Writing help in the composer | `ai helper enabled`                                                 |
| Chat with an AI bot          | `ai bot enabled`                                                    |
| Semantic search              | `ai embeddings semantic search enabled` (needs an embeddings model) |

Try each one with a few colleagues before opening it to everyone.

### Step 5: Set Up a Weekly AI Report for Staff

1. Create a new agent. Allow only your staff group to use it. Give it this system prompt:

```text
You write a weekly report for the staff of this forum.

Read the topics that were active in the last 7 days. Do not group them by
category or tag. Instead, report on:

1. Themes that appear across several categories
2. Questions that keep coming back
3. Topics with many views but no replies or no accepted answer
4. Changes in tone compared with the previous week
5. Anything that needs staff attention

Link to the topics you mention. Do not quote private messages and do not
include email addresses or other personal details. If you are not sure
about a trend, say so instead of guessing.
```

2. Open Automation from the Plugins page. Create an automation with the **Periodic report using AI** script.
3. Choose your agent and your model. Both are required, and the report runs on the model you choose here. Enter the ID of a topic in a private staff category, where the report is posted. Set it to run every seven days.
4. Private categories are left out unless you turn on **Allow secure categories**. Turn it on only if staff need them in the report.

The script reads 150 tokens of each post by default.
If reports feel shallow, raise **tokens per post**.
Keep an eye on the cost.

### Watch Out

- **An error can come from Discourse, not from your provider.** With a Mistral model, I got `reasoning_effort is not enabled for this model`. Then I switched to a model that supports reasoning. The error became `no implicit conversion of Hash into String`, which is a Ruby error inside Discourse. Leaving the reasoning effort field empty avoids the first error. If you hit errors like these, switch the model or provider and report it on meta.discourse.org.
- **`-latest` model names can change under you.** An alias can start pointing to a model with different behavior. Use a fixed model ID.
- **Changing the default model does not move everything.** Agents with a model set explicitly keep using it. Open the old model, check what still uses it and update each one. Then delete it.
- **AI activity is logged in two places.** Requests show up in your provider's usage dashboard and in Discourse's AI logs. Other admins can see those logs. Keep reports staff-only and leave out private categories.

## Module 11: Keep a Self-Hosted Site Running

**Goal:** keep a self-hosted site up to date.

Hosted sites can skip this module.
Security and backups are in Module 2, steps 6 and 7.

### 1. Install Plugins

Many popular plugins are now bundled with Discourse.
They only need turning on in the settings.
Check the Plugins page in the admin area first.

For other plugins, add them to the `hooks` section of `/var/discourse/containers/app.yml`:

```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - git clone https://github.com/discourse/docker_manager.git
          - git clone https://github.com/example/discourse-example-plugin.git
```

Keep the `docker_manager` line that is already there.
It powers updates from the admin panel.
Then rebuild (see Keep Discourse Updated below).

Only install plugins you trust.
A plugin has full access to your site and its data.

### 2. Keep Discourse Updated

Discourse versions are named by date, for example `v2026.10.0`.
They come out roughly monthly.
You can choose a release channel in `app.yml`:

| Channel   | Meant for                                                     |
| --------- | ------------------------------------------------------------- |
| `latest`  | The newest changes, updated continuously. This is the default |
| `release` | Monthly releases                                              |
| `esr`     | Extended support releases, about twice a year                 |

To pick one, set `version` under `params` in `app.yml`, then rebuild:

```yaml
params:
  version: release
```

The older names `tests-passed`, `beta` and `stable` still work.
They are deprecated.

**Regular updates:** use the Upgrade page in the admin area (`/admin/upgrade`).

**Full rebuild:** rebuild from the server every few months, after changing `app.yml`, or when the admin panel asks you to.
A rebuild also updates the underlying Docker image.
Make a backup first, then:

```bash
sudo -s
cd /var/discourse
apt install -y tmux      # if it is not installed yet
tmux new -s rebuild      # keeps the rebuild running if your connection drops
./launcher rebuild app
```

The rebuild takes several minutes.
The site is offline while it runs.
If your connection drops, log back in and run `tmux attach -t rebuild`.

When it is done, check that the site loads.
Then free up disk space:

```bash
./launcher cleanup
```

**Major PostgreSQL upgrades** happen from time to time.
They are announced on meta.discourse.org.
Read the announcement before rebuilding.
Have a backup you can restore on a fresh server.

### 3. Watch the Basics

- Set up uptime monitoring with a service such as UptimeRobot or Better Stack.
- Set an alert for disk space. Local backups and uploads can fill the disk and take the site down.
- Keep only as many backups as you need, so old member data does not stay around longer than necessary.
- When something breaks, check the logs. Use the **Logs** page in the admin area (`/logs`), or `./launcher logs app` on the server.

### Watch Out

- **The web updater can stop working.** If the Docker image is too old, updates from the admin panel are blocked. Run `./launcher rebuild app` from the server to fix it.
- **A rebuild prints a lot, and some lines look like the end.** "Redis is now ready to exit" appears partway through, when the old container stops. Wait for the command to finish. Then check with `docker ps` and load the site.
- **Rebuilds need free disk space.** If a rebuild fails with disk errors, run `./launcher cleanup` and remove old local backups. Then try again.
- **Old release channel names still work, for now.** If your `app.yml` uses `stable` or `tests-passed`, plan to switch to the new names.

## Side Path: Move an Existing Site to Discourse

**Goal:** move a community from another platform without losing links, analytics or consent records.

Only follow this path if you are moving from another platform.

### Before the Move

1. List the old URLs that get the most traffic, so you can redirect them.
2. Decide whether the domain stays the same. This affects cookies, consent and analytics.
3. Agree with whoever owns your analytics and cookie consent tools on what will change and when.

### Move the Content

Discourse has import scripts for many platforms.
On self-hosted sites you run them yourself.
On hosted plans, migration help depends on your plan. Ask Discourse support.

### Redirect Old Links

Add **permalinks** on the Permalinks page in the admin area.
A permalink sends an old URL to the matching topic, category or user.
This keeps search engine rankings and bookmarks working.

### Fix Links Inside Posts

Use the Data Explorer query from Module 8 to find posts that still link to the old address.
On a self-hosted site, you can replace them all at once with a rake task.
A rake task is a maintenance command that ships with Discourse.
Take a backup first, then:

```bash
cd /var/discourse
./launcher enter app
rake "posts:remap[https://old.example.com,https://forum.example.com]"
```

The task asks you to confirm, then shows how many posts it changed.
On hosted sites, ask support to run it.

### Check Analytics

1. Make sure only one tool sends page views: either Discourse's own Google Analytics setting or your tag manager, not both.
2. In Google Analytics 4, open a report without any hostname filter. Add the **Hostname** and **Page location** dimensions.
3. Look at the page views. If they show the hostname `(not set)` and page locations that are only a path, such as `/t/topic-name/123`, your tag is sending the path instead of the full URL. In Google Tag Manager, set the `page_location` parameter of the page view tag to `{{Page URL}}`.

### Check Cookie Consent

If the domain stays the same, the old consent cookie stays in visitors' browsers.
Many will not see the banner again.

To ask everyone again, publish your consent banner with the re-consent option turned on in your consent tool.
If the same consent setup is shared with another site, this affects both sites.
Agree on it with the other owners first.

### Watch Out

- **Consent does not reset on its own.** On the same domain, visitors keep their old cookie choices until you trigger re-consent.
- **Sessions can look normal while page views drop.** Other events carry the full URL, so only page views lose their hostname. Always check reports without a hostname filter after a move.
- **Old addresses keep sending data.** A staging or old address can keep reporting to your production analytics. Check which hostnames report to your property after a move.

## Where to Go Next

Once you have worked through the modules, meta.discourse.org is the best place to keep learning.
The Discourse team and other admins post guides, announcements and answers there.
Search it before you change anything big.
Settings and defaults do change between versions.

I am still learning a lot of this as I go.

If you have run into something similar, or solved it a different way, I would love to hear about it.

## Sources

Checked on 30 October 2026.

- [Install Discourse on a cloud server](https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md)
- [Discourse pricing](https://www.discourse.org/pricing)
- [Introducing the Discourse Free plan](https://blog.discourse.org/2026/07/introducing-the-discourse-free-plan/)
- [Discourse site settings (source)](https://github.com/discourse/discourse/blob/main/config/site_settings.yml)
- [Discourse API documentation](https://docs.discourse.org/)
- [Customize text in Discourse](https://meta.discourse.org/t/customize-text-in-discourse/36092)
- [Configure automatic backups for Discourse](https://meta.discourse.org/t/configure-automatic-backups-for-discourse/14855)
- [Manually update Discourse and the Docker image](https://meta.discourse.org/t/manually-update-discourse-and-docker-image-to-latest/23325)
- [A new versioning strategy for Discourse](https://meta.discourse.org/t/rfc-a-new-versioning-strategy-for-discourse/383536)
- [Discourse GitHub](https://meta.discourse.org/t/discourse-github/99895)
- [Automate the syncing of Discourse queries to Google Sheets](https://meta.discourse.org/t/automate-the-syncing-of-discourse-queries-to-google-sheets/394473)
- [Discourse AI periodic summary reports](https://meta.discourse.org/t/discourse-ai-periodic-summary-reports/290236)
- [PostCreator (source)](https://github.com/discourse/discourse/blob/main/lib/post_creator.rb)
- [Discourse rate limiter (source)](https://github.com/discourse/discourse/blob/main/lib/rate_limiter.rb)
- [GitHub Actions: secure use reference](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
