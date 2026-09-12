---
title: 'Open Source Is Not Just Code: Designing Communities That Actually Scale'
date: 2026-07-10
category: 'open-source'
tags: ['community', 'governance', 'maintainers', 'sustainability', 'talks']
teaser: 'The best code in the world does not save a project if nobody can figure out how to contribute to it, or if the handful of people maintaining it burn out.'
featured: true
readingTime: 14
seoTitle: 'Open Source Is Not Just Code'
seoDescription: 'Six pillars that decide whether an open source project lasts: governance, contributor experience, recognition, local community, communication and funding.'
---

Open source runs almost everything we depend on. [Linux](https://www.kernel.org/) is in the cloud and inside every Android phone. [Git](https://git-scm.com/) version controls nearly all software written today. [curl](https://curl.se/) moves data inside cars, televisions, phones, and servers. [OpenSSL](https://www.openssl.org/) secures a huge share of the traffic on the web. [Python](https://www.python.org/) powers most data work and most of modern AI. [Kubernetes](https://kubernetes.io/) runs cloud infrastructure at scale. You almost certainly used several of them before breakfast.

The uncomfortable part is that a lot of that software is maintained by very small teams, often unpaid volunteers. That is why sustaining these communities matters so much.

## The comfortable myth

Most of us quietly believe that a project succeeds because the code is good. Better architecture, cleaner tests, faster releases, and everything else follows. It is a comfortable story, because the code is the part we control.

It is also mostly wrong. The best code in the world does not save a project if nobody can figure out how to contribute to it, or if the handful of people maintaining it burn out.

What actually kills projects is more mundane. When contribution paths are unclear, people who want to help do not know how, so they simply do not. When expectations are never written down, everyone guesses, and that breeds confusion and quiet conflict. Over time, a few people absorb all of the work and all of the pressure. The project looks healthy for years. Then one person steps back, and the whole thing turns fragile and stalls.

## Open source is a socio-technical system

Open source is a socio-technical system. The code and the community are not two things you manage separately. They are one system, and they shape each other.

When the community is healthy, the code benefits. When the community breaks down, the code suffers, no matter how elegant it is. Community design is not a soft or secondary concern. It matters as much as the technical design.

## The maintainer trap

The most common failure has a name. In the maintainer trap, the same few people end up doing everything, and the entire community comes to depend on them. We call those people heroes, and we mean it kindly. But cheering for someone who is overloaded does not fix the overload.

When one person becomes a single point of failure, that is a design flaw in the project, not a weakness in the person.

[Rust](https://www.rust-lang.org/governance) avoids this on purpose. Instead of one or two heroes, the work is split across topic teams, each owning its own area, with a council coordinating them. Ownership is spread by design, so no single person carries the whole project.

## Six pillars that decide whether a project lasts

If nobody should carry a project alone, the real question is how you share the load in practice. Six pillars matter most: governance, contributor experience, recognition, local community, communication, and funding. I will take each in turn, with a project that does it well.

### 1. Governance

Governance sounds heavy, but it just means deciding how you will decide, before a crisis forces you to. Put the shared things, funding, events, and infrastructure, under a neutral body instead of one person. Spread maintainer roles across more people. Give conflict a clear route.

There is no one right shape. Some projects run on a benevolent dictator, some on a council, some under a foundation. What matters is that the model is explicit, not accidental. Big projects usually mix several. Kubernetes layers all three: a foundation holds the assets, a steering committee makes the cross-cutting calls, and individual teams run the day to day.

The opposite extreme is a project controlled entirely by one company. That is common and not always bad, but the company's interests and the community's can split, and the community usually finds out last.

[Apache](https://www.apache.org/theapacheway/) is a good model, and it is built to prevent exactly that. Each project is governed by its own Project Management Committee, or PMC, which controls the project and decides who joins it. You earn a place on the PMC through merit, meaning the work you actually do on the project, not your job title or your employer. And you sit on it as an individual, never on behalf of a company. Apache is strict about this: companies do not get a seat, only people do. If one employer begins to dominate a PMC, the board intervenes and pushes for more diversity.

Governance feels boring right up until the day you desperately need it.

**A code of conduct** is part of governance, and it needs to be specific, not aspirational. Name what is unacceptable, including harassment, discrimination, personal attacks, and sustained disruption. Then enforce it, because a code nobody acts on is worse than having none at all: it signals a safety that does not exist. The [Contributor Covenant](https://www.contributor-covenant.org/) is a widely adopted starting point, setting out expected behavior, unacceptable behavior, and a path to report and act on violations.

### 2. Contributor experience

Contributor experience is about lowering the cost of a first contribution. Give people a clear place to start. Label good first issues. Make the path from first patch to trusted contributor visible, so people can see a future in the project.

[Kubernetes](https://github.com/kubernetes/community/blob/master/community-membership.md) does this well, with a published ladder running from member to reviewer to approver, mentoring cohorts, and a graceful way to step back when life gets busy.

When the path is confusing, people do not complain. They leave, and you never learn why.

I know that feeling from my own start. My first contribution was in 2021, during Covid, before I had really interacted with the Drupal community beyond the people I worked with. Writing the issue took me 45 minutes. Not the code, just the issue, because I was scared of being judged. Nobody judged me. People were kind and helpful the whole way. That gap between how frightening it felt and how welcoming it actually was is exactly what good contributor experience should close.

### 3. Recognition

Most communities recognize the visible work: features, code, commits. But the majority of what keeps a project alive is invisible. Review, triage, documentation, and mentoring do not show up in a commit graph. Invisible work gets undervalued, and once it is undervalued, people stop doing it.

The fix is to make it visible. Record who actually did the work, and let that credit reach the companies funding it. [Drupal's contribution credit system](https://www.drupal.org/docs/develop/issues/fields-and-other-parts-of-an-issue/getting-credit-for-work-on-issues) does this publicly and at scale, attributing every issue across both code and the invisible work, and crediting sponsoring organizations alongside individuals.

Recognition is not just being nice. It quietly changes what people do. Individuals get credit tied to real work. The system records it, so nobody has to advocate for themselves, and the unglamorous work becomes worth doing. Companies get visible standing for what they fund, so their business interest lines up with the health of the project.

Put those together and recognition stops being a favor you ask for. It becomes something the system produces on its own. The pattern I keep seeing is that when a company treats contribution as real work, with time and budget behind it, the involvement lasts. Good incentives beat good intentions every time.

### 4. Local community

People do not form belonging at a 2,000-person conference. They form it in small rooms, over shared problems, working together. So pair the big global event with small local ones, where the barrier drops.

Drupal is the community I know best. [DrupalCon](https://events.drupal.org/) is the flagship, but the real engine is the local camps, run by volunteers and kept deliberately small. That is where new people get pulled in, and where most organizers, including me, learned how any of this works.

These events also build in real ways for newcomers to start, rather than leaving them to watch from the back of a room:

- **[Mentorship workshops](https://www.drupal.org/community/contributor-guide/role/mentor)**, run by a volunteer team at almost every event, so nobody has to figure it out alone.
- **[Contribution days](https://events.drupal.org/atlanta2025/contribution)**, which give people a dedicated room to sit down together and actually contribute.
- **[Drupal in a Day](https://www.drupal.org/drupalorg/blog/state-of-drupal-open-university)**, a newer initiative that brings students in and teaches them Drupal from scratch.

Each of those lowers a different barrier: fear, logistics, and awareness.

I felt this clearly at DrupalMountain Camp, in a workshop called Why Drupal, where we talked about why we each contribute. Different backgrounds, different journeys, but the same underlying goal: build something meaningful and grow while doing it. That is what "come for the code, stay for the community" actually means.

### 5. Communi&shy;cation

Communication is the pillar communities most often skip. A project needs people who can explain what problem it solves and why anyone should care. This matters most early, when nobody knows the project exists. Good communication is what turns a useful tool into a known one.

That work lives in documentation, tutorials, blog posts, videos, conference talks, and case studies. Great code that nobody understands just sits there. Explaining it should not be an afterthought.

### 6. Funding and sponsorship

Funding is the pillar we are shyest about. Time is not free. Someone always pays, either in money or in unpaid evenings and weekends. Without sustainable funding, we are asking volunteers to quietly subsidize infrastructure everyone depends on.

Fund the boring, critical work: maintenance, security, and documentation. Not just the shiny new features. [Django](https://www.djangoproject.com/fundraising/) shows what that looks like: the Django Software Foundation raises money and pays Fellows who triage tickets, review patches, and ship releases, the work that otherwise would not get done.

A project does not need funding on day one. Small projects run fine on volunteer time. But as more people depend on you, keep sustainability in mind and put funding in place before the load gets too heavy.

Where to look: [Open Collective](https://opencollective.com/), [GitHub Sponsors](https://github.com/sponsors), and [Patreon](https://www.patreon.com/) for direct support, [Tidelift](https://tidelift.com/) for paying maintainers through subscriptions, and the [Sovereign Tech Fund](https://www.sovereign.tech/programs/fund) for public investment in critical infrastructure.

## How to tell whether it is working

It is easy to say you have these pillars. Four signals tell you whether they are real:

- **Bus factor.** How many people could walk away before the project stalls? If the answer is one, that is the maintainer trap in numbers.
- **Time to first response** on issues and pull requests. Slow first responses are where newcomers quietly give up.
- **Retention.** Do first-time contributors come back, or is every contributor a new face who never returns?
- **Maintainer count.** Growing, holding, or shrinking? A shrinking count is an early warning, long before anything visibly breaks.

Watch the trend, not a single snapshot. Together these tell you if the pillars are actually working, or just look good on paper.

## What to prioritize, and what can wait

Not everything deserves your attention at once.

Optimize early: clear contribution paths, expectations written down, and distributing authority before it all lands on one person. These are cheap now and expensive to fix later.

Delay heavy formal governance, complex tooling and automation, and structure a small community does not need yet. Heavy process can strangle a small project before it ever grows.

There is a similar trap in how we take advice. Most good advice only works when you pair it with the right thing. Being welcoming works only if you keep up with the people who show up. An ignored first contribution is the fastest way to lose someone, and triage is what makes the welcome real. Moving fast works only with transparency, so contributors can follow the changes and not get blindsided. Documenting everything works only with clear ownership, so the docs stay current. The practice is not the problem. The missing partner is.

## What AI changes

One force is reshaping all six pillars at once, so it deserves its own section.

AI helps. It lowers the barrier to a first contribution, speeds up documentation, translation, and issue triage, and helps people who do not work in English as a first language. It can also shorten the time needed to understand a codebase, which could ease the reliance on spare free time that open source has always depended on.

The strain is just as real. It is cheap to generate a change, but a maintainer still has to understand it, so the cost shifts from author to reviewer. Access is unequal too. The best tools cost money and know-how, so people at well-funded companies get faster, while volunteers and people in lower-income regions get left behind. AI risks becoming a new kind of privilege.

This is not theoretical. Someone asks a model to find a bug, pastes the confident output into a report, marks it critical, and never checks whether it is real. curl is the clearest case. [Daniel Stenberg](https://daniel.haxx.se/blog/), who has maintained it for decades, called it a denial of service on the project. By 2025 roughly 1 in 5 submissions was slop, and fewer than 1 in 20 turned out to be a genuine vulnerability. Each fake report can take an hour to debunk, and these are volunteers with a few hours a week. The team eventually shut down its paid bug bounty simply to stop the flood.

It is not only curl. The [Python Software Foundation](https://sethmlarson.dev/slop-security-reports) and Open Collective report the same thing, and tie it directly to maintainer burnout. The problem is the asymmetry: seconds to generate, hours to debunk, aimed at unpaid people who keep critical software running. As Dries Buytaert puts it in [The Privilege of AI in Open Source](https://dri.es/the-privilege-of-ai-in-open-source):

> AI can make it cheaper to contribute without making it cheaper to review.

To be fair, the same tools in skilled hands recently found dozens of real bugs in curl. So the tool is not the problem. Unverified slop is. AI does not replace community design. It raises the stakes on the same six pillars.

## Why some projects thrive and others decay

If you remember one thing from this, remember this contrast.

| Thriving projects     | Decaying projects            |
| --------------------- | ---------------------------- |
| Share decisions       | Concentrate decisions        |
| Make it easy to help  | Leave contributors guessing  |
| Recognize the work    | Let invisible work go unseen |
| Build local belonging | Stay purely global           |
| Communicate the why   | Stay hard to understand      |
| Fund the work         | Rely on unpaid time          |

The dangerous part is that decay is slow and quiet. There is no alarm. You often notice only when it is far along.

## What you can realistically influence

You do not have to be a maintainer, or even a contributor. If you care about open source, any of these help:

- Document one thing that confused you when you joined.
- Review someone's first contribution.
- Credit invisible work out loud, where people can see it.
- Help one local event happen.
- Fund a project you rely on, even a little.
- Share a project you use with your team or on social media.

> I fund 5 maintainers, about 100 euros a month in total. It is small, but steady support like this is what keeps people going, and it nudges others to chip in too.

These are small structural acts, and they compound.

## Closing

Open source is not just code. The system around the code is what scales, or what quietly fades. Either way, you are designing it. The only question is whether you do it on purpose.

Be honest with yourself too. There is no quick fix. You will not get it all right, and you usually control your corner, not the whole. Changing a community default is slow, and that is normal.

So do not try to move all six pillars at once. Pick the one that hurts most right now, and start there.

---

## About this talk

This article is based on my talk, _Open Source Is Not Just Code: Designing Communities That Actually Scale_, given at the [WeAreDevelopers World Congress](https://www.wearedevelopers.com/world-congress/agenda/sessions/open-source-is-not-just-code-designing-communities-that-actually-scale-1142282) on Friday 10 July 2026, 09:40 to 10:10, on Stage 3 (powered by AWS).

[Download the slides](/talks/open-source-is-not-just-code.pdf) (PDF, 815 KB, 31 pages). The article above is the accessible version: the deck is an untagged export, so a screen reader gets very little out of it.

---

## Sources and further reading

### Primary reading

- David Hirsch, [Open Source Communities](https://www.linkedin.com/pulse/open-source-communities-david-hirsch/)
- Dries Buytaert, [The Privilege of AI in Open Source](https://dri.es/the-privilege-of-ai-in-open-source)
- Chris Short, [OSPO Notes: Open Source Governance, Who Decides and How](https://chrisshort.net/ospo-notes-open-source-governance-who-decides-and-how/)

### Community models

- Rust, [Governance and teams](https://www.rust-lang.org/governance)
- Apache Software Foundation, [The Apache Way](https://www.apache.org/theapacheway/)
- Contributor Covenant, [Code of conduct](https://www.contributor-covenant.org/)
- Kubernetes, [Contributor ladder](https://github.com/kubernetes/community/blob/master/community-membership.md)
- Drupal, [Contribution credit](https://www.drupal.org/docs/develop/issues/fields-and-other-parts-of-an-issue/getting-credit-for-work-on-issues)

### Drupal programs

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

### AI and maintainer burden

- Daniel Stenberg, [curl blog](https://daniel.haxx.se/blog/)
- Seth Larson, [New era of slop security reports for open source](https://sethmlarson.dev/slop-security-reports)

### Projects referenced

- [Linux](https://www.kernel.org/)
- [Git](https://git-scm.com/)
- [curl](https://curl.se/)
- [OpenSSL](https://www.openssl.org/)
- [Python](https://www.python.org/)
- [Kubernetes](https://kubernetes.io/)
