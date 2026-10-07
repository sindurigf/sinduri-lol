---
title: 'Open Source Is Not Just Code: Designing Communities That Actually Scale'
date: 2026-07-10
category: 'open-source'
placeholder: false
tags: ['community', 'governance', 'maintainers', 'sustainability', 'talks']
teaser: 'The best code in the world does not save a project if nobody can figure out how to contribute to it, or if the handful of people maintaining it burn out.'
featured: true
readingTime: 14
seoTitle: 'Open Source Is Not Just Code'
cover: '../../assets/blog/open-source-is-not-just-code/mentoring-table.jpg'
coverAlt: 'Sinduri writing on sticky notes at the Drupal mentoring table at DrupalCon Rotterdam, beside a sign that reads Many tiny drops make an ocean.'
coverCredit: 'Bram Driesen'
seoDescription: 'Six pillars that decide whether an open source project lasts: governance, contributor experience, recognition, local community, communication and funding.'
---

Open source runs almost everything we depend on. You almost certainly used several of these before breakfast:

- [Linux](https://www.kernel.org/) runs the cloud and every Android phone.
- [Git](https://git-scm.com/) version-controls nearly all software written today.
- [curl](https://curl.se/) moves data inside cars, televisions, phones and servers.
- [OpenSSL](https://www.openssl.org/) secures a huge share of the traffic on the web.
- [Python](https://www.python.org/) powers much of data work and modern AI.
- [Kubernetes](https://kubernetes.io/) runs cloud infrastructure at scale.

The uncomfortable part is that much of this software is maintained by very small teams, often unpaid volunteers. That is why sustaining these communities matters so much.

## The Comfortable Myth

Most of us quietly believe that a project succeeds because its code is good: better architecture, cleaner tests and faster releases, and everything else follows. It is a comfortable story, because the code is the part we control.

The story is mostly wrong: brilliant code cannot save a project when nobody can work out how to contribute, or when the few people maintaining it burn out.

What actually kills projects is more ordinary:

- **Unclear contribution paths.** People who want to help do not know how, so they do not.
- **Unwritten expectations.** Everyone guesses, and that breeds confusion and quiet conflict.
- **Concentrated work.** A few people absorb all of the work and all of the pressure. The project looks healthy for years. Then one person steps back, and the whole thing turns fragile and stalls.

## Open Source Is a Socio-Technical System

Open source is a socio-technical system: the people and the technology depend on each other, and neither works without the other. The code and the community are not two things you manage separately. They are one system, and they shape each other.

![Sinduri standing and clapping in a lecture hall full of Drupal event attendees.](../../assets/photos/drupal-lecture-hall.jpg 'Photo: Andrey Pshenichny')

When the community is healthy, the code benefits. When the community breaks down, the code suffers, however elegant it is. So community design is not a soft or secondary concern. It matters as much as the technical design.

## The Maintainer Trap

The most common failure has a name. In the maintainer trap, the same few people end up doing everything, and the whole community comes to depend on them. We call those people heroes, and we mean it kindly. But cheering for someone who is overloaded does not take any of the load off them.

When one person becomes a single point of failure, that is a design flaw in the project, not a weakness in the person.

![An attendee in red braces working alone on a laptop at a high table, in a quiet DrupalCon Rotterdam exhibition hall.](../../assets/blog/open-source-is-not-just-code/maintainer-at-laptop.jpg 'Photo: Joris Vercammen')

[Rust](https://www.rust-lang.org/governance) avoids this on purpose. Instead of relying on one or two heroes, it splits the work across topic teams, each owning its own area, with a council coordinating them. Ownership is spread by design, so no single person carries the whole project.

## Six Pillars That Decide Whether a Project Lasts

If nobody should carry a project alone, the real question is how to share the load in practice. Six pillars matter most: governance, contributor experience, recognition, local community, communication and funding. I will take each in turn, with a project that does it well.

### 1. Governance

Governance sounds heavy, but it simply means deciding how you will make decisions, before a crisis forces you to. In practice:

- Put the shared things, such as funding, events and infrastructure, under a neutral body instead of one person.
- Spread maintainer roles across more people.
- Give conflict a clear route.

![Drupal board members standing together on a conference stage, in event lanyards.](../../assets/blog/open-source-is-not-just-code/drupal-board.jpg 'Photo: Karl Hepworth')

There is no one right model. Some projects run on a benevolent dictator, some on a council and some under a foundation. What matters is that the model is explicit, not accidental. Big projects usually mix several. Kubernetes layers all three:

- A foundation holds the assets.
- A steering committee makes the calls that cut across the whole project.
- Individual teams run the day to day.

The opposite extreme is a project controlled entirely by one company. That is common and not always bad, but the company's interests and the community's can split, and the community usually finds out last.

[Apache](https://www.apache.org/theapacheway/) is a good model, and it is built to prevent exactly that:

- Each project is governed by its own Project Management Committee (PMC), which controls the project and decides who joins it.
- You earn a place on the PMC through merit: the work you actually do on the project, not your job title or your employer.
- You sit on it as an individual, never on behalf of a company. Companies do not get a seat; only people do.
- If one employer begins to dominate a PMC, the Apache board steps in and pushes for more diversity.

Nobody thinks about governance while things go well. It is what decides how a project gets through the day things go wrong.

**A code of conduct** is part of governance, and it needs to be specific, not aspirational:

- Name what is unacceptable, including harassment, discrimination, personal attacks and sustained disruption.
- Enforce it. A code nobody acts on is worse than having none, because it signals a safety that does not exist.

The [Contributor Covenant](https://www.contributor-covenant.org/) is a widely adopted starting point. It sets out expected behavior, unacceptable behavior and a path to report and act on violations.

### 2. Contributor Experience

Contributor experience is about lowering the cost of a first contribution:

- Give people a clear place to start.
- Label good first issues.
- Make the path from first patch to trusted contributor visible, so people can see a future in the project.

![The Drupal.org contributor guide's Contribution areas page. It says the Drupal project has many areas you can contribute to, not just the Drupal Core code, and lists them: accessibility, community building, contributed modules, themes and distributions, the contributor guide, documentation, Drupal core, Drupal.org websites, event planning, knowledge sharing, marketing, mentoring, support, translation and usability.](../../assets/blog/open-source-is-not-just-code/contribution-areas.png 'Screenshot: Drupal.org')

[Kubernetes](https://github.com/kubernetes/community/blob/master/community-membership.md) does this well:

- A published ladder that runs from member to reviewer to approver.
- Mentoring cohorts.
- A graceful way to step back when life gets busy.

When the path is confusing, people do not complain. They leave, and you never learn why.

I know that feeling from my own start. My first contribution was in 2021, during the pandemic, before I had really interacted with the Drupal community beyond the people I worked with. Writing the issue took me 45 minutes. Not the code, just the issue, because I was scared of being judged. Nobody judged me. People were kind and helpful the whole way. Good contributor experience should close exactly that gap between how frightening it feels and how welcoming it actually is.

### 3. Recognition

Most communities recognize the visible work: features, code and commits. But most of what keeps a project alive is invisible: review, triage, documentation and mentoring. None of it shows up in a commit graph. Invisible work gets undervalued, and once it is undervalued, people stop doing it.

The fix is to make it visible. Record who actually did the work, and let that credit reach the companies funding it. [Drupal's contribution credit system](https://www.drupal.org/docs/develop/issues/fields-and-other-parts-of-an-issue/getting-credit-for-work-on-issues) does this publicly and at scale. It credits every issue, for code and for the invisible work, and credits sponsoring organizations alongside individuals.

Recognition is not just being nice. It quietly changes what people do:

- **Individuals** get credit tied to real work. The system records it, so nobody has to advocate for themselves, and the unglamorous work becomes worth doing.
- **Companies** get visible standing for what they fund, so their business interest lines up with the health of the project.

With credit for individuals and standing for companies, recognition stops being a favor you ask for. It becomes something the system produces on its own. The pattern I keep seeing is that when a company treats contribution as real work, with time and budget behind it, its involvement lasts. Good intentions bring people in. Good incentives make contribution last.

### 4. Local Community

People do not find belonging at a 2,000-person conference. They find it in small rooms, working together on shared problems. So pair the big global event with small local ones, where the barrier to joining drops.

![About twenty Drupal Austria meetup attendees posing together in a room, one of them holding a Drupal Austria sign.](../../assets/blog/open-source-is-not-just-code/drupal-austria-meetup.webp 'Photo: lowfidelity')

Drupal is the community I know best. [DrupalCon](https://events.drupal.org/) is the flagship, and it keeps pulling people in: at DrupalCon Rotterdam, 27% of attendees were new to DrupalCon. But the real engine is the local camps, run by volunteers and kept deliberately small. That is where new people get pulled in, and where most organizers, including me, learned how any of this works.

Drupal events, big and small, also give newcomers three ways to start, instead of leaving them to watch from the back of the room. Each one lowers a different barrier:

- **[Mentorship workshops](https://www.drupal.org/community/contributor-guide/role/mentor)** lower fear. A volunteer team runs them at almost every event, so nobody has to figure it out alone.
- **[Contribution days](https://events.drupal.org/atlanta2025/contribution)** lower the logistics. They give people a dedicated room to sit down together and actually contribute.
- **[Drupal in a Day](https://www.drupal.org/drupalorg/blog/state-of-drupal-open-university)** raises awareness. It is a newer initiative that brings students in and teaches them Drupal from scratch.

I felt this clearly at [Drupal Mountain Camp](https://drupalmountaincamp.ch/), in a workshop called Why Drupal led by [Mikko Hämäläinen](https://www.drupal.org/u/mkoh), CEO of Druid, where we talked about why each of us contributes. Different backgrounds, different journeys, but the same underlying goal: build something meaningful and grow while doing it. That shared goal is why people say "come for the code, stay for the community".

### 5. Communi&shy;cation

Communication is the pillar communities most often skip. A project needs people who can explain what problem it solves and why anyone should care. This matters most early on, when nobody knows the project exists. Good communication is what turns a useful tool into a known one.

That work lives in:

- documentation and tutorials
- blog posts and videos
- conference talks and case studies

Great code that nobody understands just sits there unused, so explaining it should never be an afterthought. Drupal now counts this work as contribution: in a pilot, the Drupal Association awards contribution credit for advocacy, such as telling the story of modern Drupal.

![New, a Drupal Association pilot: Advocacy now earns contribution credit. Tell the story of modern Drupal. The Drupal Association awards the credit. Create, then share, then earn credits, at drupal.org/advocacy.](../../assets/blog/open-source-is-not-just-code/advocacy-contribution-credit.png 'Screenshot: Drupal Association')

### 6. Funding and Sponsorship

Funding is the pillar we are shyest about. Time is not free. Someone always pays, either in money or in unpaid evenings and weekends. I pay my own way and take time off to attend Drupal events. Without sustainable funding, we are asking volunteers to quietly subsidize infrastructure everyone depends on.

Fund the boring, critical work, not just the shiny new features:

- maintenance
- security
- documentation

[Django](https://www.djangoproject.com/fundraising/) shows what that looks like. The Django Software Foundation raises money and pays Fellows who triage tickets, review patches and ship releases: the work that otherwise would not get done.

A project does not need funding on day one. Small projects run fine on volunteer time. But as more people depend on you, keep sustainability in mind and put funding in place before the load gets too heavy.

Where to look:

- **Direct support:** [Open Collective](https://opencollective.com/), [GitHub Sponsors](https://github.com/sponsors) and [Patreon](https://www.patreon.com/).
- **Paying maintainers through subscriptions:** [Tidelift](https://tidelift.com/).
- **Public investment in critical infrastructure:** the [Sovereign Tech Fund](https://www.sovereign.tech/programs/fund).

## What AI Changes

One force is reshaping all six pillars at once, so it deserves its own section.

**Where AI helps:**

- It lowers the barrier to a first contribution.
- It speeds up documentation, translation and issue triage.
- It helps people who do not work in English as a first language.
- It shortens the time needed to understand a codebase, which could ease open source's long reliance on people's spare time.

**Where AI adds strain:**

- It is cheap to generate a change, but a maintainer still has to understand it, so the cost shifts from the author to the reviewer.
- Access is unequal. The best tools cost money and know-how, so people at well-funded companies get faster, while volunteers and people in lower-income regions get left behind. AI risks becoming a new kind of privilege.

This is not theoretical. Someone asks a model to find a bug, pastes the confident output into a report, marks it critical and never checks whether it is real. curl is the clearest case:

- [Daniel Stenberg](https://daniel.haxx.se/blog/), who has maintained curl for decades, called it a denial of service on the project.
- In 2025, [about 1 in 5 submissions was AI slop, and only about 1 in 20 turned out to be a genuine vulnerability](https://daniel.haxx.se/blog/2025/07/14/death-by-a-thousand-slops/). AI slop means reports generated by AI that sound technical but describe no real problem.
- Each report takes three or four people from the security team, for 30 minutes to three hours each. They are volunteers with a few hours a week.
- In January 2026 the team [ended its paid bug bounty](https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/), simply to stop the flood.

In October 2026 Daniel [posted on LinkedIn](https://www.linkedin.com/posts/danielstenberg_google-closing-their-vdp-oss-program-made-share-7513141850833068032-KLmR/):

> Google closing their VDP OSS program made half a dozen journalists email me for comments. I've told them: in the open source world we don't anymore have the slop problem Google seem to address now, half a year after we've seen it mostly go away by itself. These days, we have a high volume high quality challenge.

It is not only curl. The [Python Software Foundation](https://sethmlarson.dev/slop-security-reports) and Open Collective report the same thing, and tie it directly to maintainer burnout. The problem is the asymmetry: seconds to generate, hours to debunk, aimed at unpaid people who keep critical software running. As Dries Buytaert puts it in [The Privilege of AI in Open Source](https://dri.es/the-privilege-of-ai-in-open-source):

> AI can make it cheaper to contribute without making it cheaper to review.

The same tools have also found real bugs in curl. In 2025, [Joshua Rogers checked the output of several AI scanners himself and reported about 50 genuine bugs in curl](https://www.theregister.com/2025/10/02/curl_project_swamped_with_ai/), which the team fixed. So the tool is not the problem. Unverified slop is. AI does not replace community design. It raises the stakes on the same six pillars.

## How to Tell Whether It Is Working

It is easy to say you have these pillars. Four signals tell you whether they are real:

- **Bus factor.** How many people could walk away before the project stalls? If the answer is one, that is the maintainer trap in numbers.
- **Time to first response** on issues and pull requests. Slow first responses are where newcomers quietly give up.
- **Retention.** Do first-time contributors come back, or is every contributor a new face who never returns?
- **Maintainer count.** Is it growing, holding or shrinking? A shrinking count is an early warning, long before anything visibly breaks.

Watch the trend, not a single snapshot. Together, these four signals tell you whether the pillars are actually working, or just look good on paper.

## What to Prioritize, and What Can Wait

Not everything deserves your attention at once.

**Optimize early.** These are cheap now and expensive to fix later:

- clear contribution paths
- expectations written down
- authority distributed before it all lands on one person

**Delay** what a small community does not need yet. Heavy process can strangle a small project before it ever grows:

- heavy formal governance
- complex tooling and automation
- structure the community has not grown into

There is a similar trap in how we take advice. Most good advice only works when you pair it with the right partner:

- **Being welcoming needs triage.** An ignored first contribution is the fastest way to lose someone, and triage is what makes the welcome real.
- **Moving fast needs transparency,** so contributors can follow the changes and are not blindsided.
- **Documenting everything needs clear ownership,** so the docs stay current.

So when a good practice is not working, check whether its partner is missing.

## Why Some Projects Thrive and Others Decay

Here is the difference between thriving and decaying projects, pillar by pillar:

| Thriving projects     | Decaying projects            |
| --------------------- | ---------------------------- |
| Share decisions       | Concentrate decisions        |
| Make it easy to help  | Leave contributors guessing  |
| Recognize the work    | Let invisible work go unseen |
| Build local belonging | Stay purely global           |
| Communicate the why   | Stay hard to understand      |
| Fund the work         | Rely on unpaid time          |

The dangerous part is that decay is slow and quiet. There is no alarm, and you often notice only after maintainers and contributors have already left.

## What You Can Realistically Influence

You do not have to be a maintainer, or even a contributor. If you care about open source, any of these help:

- Document one thing that confused you when you joined.
- Review someone's first contribution.
- Credit invisible work out loud, where people can see it.
- Help one local event happen.
- Fund a project you rely on, even a little.
- Share a project you use with your team or on social media.

I fund five maintainers, about 100 euros a month in total. It is small, but steady support like this is what keeps people going, and it nudges others to chip in too.

Each of these actions is small, but together they change how a community works.

## Closing

Open source is not just code. The system around the code is what scales, or what quietly fades. Every community has that system, whether anyone designed it or not. Shaping it on purpose gives the project a better chance to last.

Be honest with yourself too. There is no quick fix. You will not get it all right, and you usually control your own corner, not the whole community. Changing a community's defaults is slow, and that is normal.

So do not try to move all six pillars at once. Pick the one that hurts most right now, and start there.

![Drupal Mountain Camp attendees gathered in front of a wooden building, with snowy mountains behind them and Drupal and Mountain Camp banners on the ground.](../../assets/photos/drupal-mountain-camp.webp 'Photo: Patrick Itten')

---

## About This Talk

This article is based on my talk, _Open Source Is Not Just Code: Designing Communities That Actually Scale_, given at the [WeAreDevelopers World Congress](https://www.wearedevelopers.com/world-congress/agenda/sessions/open-source-is-not-just-code-designing-communities-that-actually-scale-1142282) on Friday 10 July 2026, 09:40 to 10:10, on Stage 3 (powered by AWS).

[View the slides](/talks/open-source-is-not-just-code/), or [download them](/talks/open-source-is-not-just-code.pdf) (PDF, 500 KB, 31 pages).

---

## Sources and Further Reading

### Primary Reading

- David Hirsch, [Open Source Communities](https://www.linkedin.com/pulse/open-source-communities-david-hirsch/)
- Dries Buytaert, [The Privilege of AI in Open Source](https://dri.es/the-privilege-of-ai-in-open-source)
- Chris Short, [OSPO Notes: Open Source Governance, Who Decides and How](https://chrisshort.net/ospo-notes-open-source-governance-who-decides-and-how/)

### Community Models

- Rust, [Governance and teams](https://www.rust-lang.org/governance)
- Apache Software Foundation, [The Apache Way](https://www.apache.org/theapacheway/)
- Contributor Covenant, [Code of conduct](https://www.contributor-covenant.org/)
- Kubernetes, [Contributor ladder](https://github.com/kubernetes/community/blob/master/community-membership.md)
- Drupal, [Contribution credit](https://www.drupal.org/docs/develop/issues/fields-and-other-parts-of-an-issue/getting-credit-for-work-on-issues)

### Drupal Community Initiatives

- [DrupalCon and community events](https://events.drupal.org/)
- [Mentoring and first-time contributor workshops](https://www.drupal.org/community/contributor-guide/role/mentor)
- [Contribution days at events](https://events.drupal.org/atlanta2025/contribution)
- [Drupal in a Day and Open University](https://www.drupal.org/drupalorg/blog/state-of-drupal-open-university)

### Funding

- Django, [Fellowship program](https://www.djangoproject.com/fundraising/)
- [Open Collective](https://opencollective.com/)
- [GitHub Sponsors](https://github.com/sponsors)
- [Patreon](https://www.patreon.com/)
- [Tidelift](https://tidelift.com/)
- [Sovereign Tech Fund](https://www.sovereign.tech/programs/fund)

### AI and Maintainer Burden

- Daniel Stenberg, [curl blog](https://daniel.haxx.se/blog/)
- Daniel Stenberg, [Death by a thousand slops](https://daniel.haxx.se/blog/2025/07/14/death-by-a-thousand-slops/)
- Daniel Stenberg, [The end of the curl bug-bounty](https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/)
- Daniel Stenberg, [LinkedIn post on Google closing its VDP OSS program](https://www.linkedin.com/posts/danielstenberg_google-closing-their-vdp-oss-program-made-share-7513141850833068032-KLmR/)
- Seth Larson, [New era of slop security reports for open source](https://sethmlarson.dev/slop-security-reports)
- The Register, [Curl project, swamped with AI slop, finds not all AI is bad](https://www.theregister.com/2025/10/02/curl_project_swamped_with_ai/)

### Projects Referenced

- [Linux](https://www.kernel.org/)
- [Git](https://git-scm.com/)
- [curl](https://curl.se/)
- [OpenSSL](https://www.openssl.org/)
- [Python](https://www.python.org/)
- [Kubernetes](https://kubernetes.io/)
