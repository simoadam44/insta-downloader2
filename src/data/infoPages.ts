// Content + SEO metadata for the public informational and legal pages.
//
// One source of truth, imported by:
//   - src/components/InfoPage.tsx      (rendering)
//   - src/services/seoEngine.ts        (client-side <head> sync)
//   - functions/_lib/pageMeta.ts       (first-response <head> injection)
//   - functions/_lib/seoHtml.ts        (route classification)
//   - sitemap builders (Pages / Express / Vercel)
//
// This module is deliberately dependency-free (no React, no DOM) so the
// Cloudflare Pages Functions bundler can import it safely.
//
// Content rules applied here:
//   - every claim matches the code in functions/api/* and the live settings;
//   - no invented company, address, jurisdiction, user numbers or awards;
//   - `{email}` is replaced at render time with the configured contact email.

export const INFO_PAGE_IDS = [
  'about',
  'contact',
  'how-to-use',
  'faq',
  'privacy',
  'terms',
  'disclaimer',
] as const;

export type InfoPageId = (typeof INFO_PAGE_IDS)[number];

export type InfoBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'email' }
  | { type: 'note'; text: string };

export interface InfoSection {
  id: string;
  heading: string;
  blocks: InfoBlock[];
}

export interface InfoPage {
  id: InfoPageId;
  path: `/${InfoPageId}`;
  /** <title> and og:title */
  title: string;
  /** meta description and og:description */
  description: string;
  h1: string;
  /** ISO date, also used as <lastmod> in the sitemap */
  updated: string;
  intro: string[];
  sections: InfoSection[];
  /** Optional Q&A list, rendered as headings + answers (no accordion JS). */
  faqs?: { question: string; answer: string }[];
  related: { label: string; href: string }[];
}

export const INFO_PAGE_UPDATED = '2026-10-27';

export const INFO_PAGE_PATHS: string[] = INFO_PAGE_IDS.map((id) => `/${id}`);

const RELATED_ALL: { label: string; href: string }[] = [
  { label: 'How to use IGSaveGo', href: '/how-to-use' },
  { label: 'Frequently asked questions', href: '/faq' },
  { label: 'About IGSaveGo', href: '/about' },
  { label: 'Contact us', href: '/contact' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Disclaimer', href: '/disclaimer' },
];

function relatedFor(id: InfoPageId) {
  return RELATED_ALL.filter((item) => item.href !== `/${id}`);
}

const ABOUT: InfoPage = {
  id: 'about',
  path: '/about',
  title: 'About IGSaveGo — Independent Instagram Media Downloader',
  description:
    'What IGSaveGo is, how it processes public Instagram links, and how this independent project approaches privacy, usability and responsible use.',
  h1: 'About IGSaveGo',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'IGSaveGo is a free, browser-based tool for saving publicly available Instagram videos, Reels, photos and IGTV posts to your own device. It runs at www.igsavego.com and needs no account, extension, app installation or payment.',
    'IGSaveGo is an independent project. It is not affiliated with, endorsed by or sponsored by Instagram or Meta Platforms, Inc. Instagram and Meta are trademarks of their respective owners.',
  ],
  sections: [
    {
      id: 'why',
      heading: 'The problem IGSaveGo addresses',
      blocks: [
        {
          type: 'p',
          text: 'Instagram does not provide a single, consistent "save to device" action for every media type on every platform. People often resort to screen recording, which lowers quality, or to browser extensions and mobile apps that request wide permissions or bundle unrelated software.',
        },
        {
          type: 'p',
          text: 'IGSaveGo takes a narrower approach: one input field, a public Instagram link, and a download of the media that the link points to. There is nothing to install, no Instagram password to hand over, and no account to create.',
        },
      ],
    },
    {
      id: 'what-you-can-do',
      heading: 'What you can do here',
      blocks: [
        {
          type: 'list',
          items: [
            'Paste a public Instagram post, Reel or IGTV link and preview the available media before saving it.',
            'Download a video as MP4 or a photo as JPG through the result card.',
            'Switch between the Video, Reels, Photo, Story and Highlights tabs to reach the matching tool page.',
            'Use the interface in English, Spanish, French, Arabic, Portuguese, German, Indonesian or Turkish.',
            'Read step-by-step instructions, troubleshooting notes and policy pages without creating an account.',
          ],
        },
        {
          type: 'p',
          text: 'The Story and Highlights tabs are part of the site navigation. The current extractor resolves public post, Reel and IGTV links; a story or highlight page link is not supported yet and returns an error instead of a download.',
        },
      ],
    },
    {
      id: 'how-it-works',
      heading: 'How the tool works',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Your browser sends the link you paste to our extraction endpoint, /api/extract, on the same domain.',
            'The server reads the Instagram shortcode from the link and requests public metadata and media streams from Instagram and, when needed, from fallback providers that relay the same public content.',
            'The response lists the available media. The file itself is streamed to your browser through /api/proxy-media with download-friendly headers, so the file is saved by your browser rather than stored by us.',
            'Your browser shows a preview and a download button. Choosing a download saves the file to your device using your browser\'s normal download behaviour.',
          ],
        },
        {
          type: 'p',
          text: 'Extraction happens server-side because Instagram blocks many direct browser requests for cross-origin reasons. The extraction and streaming endpoints are described in more detail in the Privacy Policy and Terms of Use.',
        },
      ],
    },
    {
      id: 'limits',
      heading: 'What IGSaveGo does not do',
      blocks: [
        {
          type: 'list',
          items: [
            'It does not access private accounts, login-protected posts, or content that is not publicly visible.',
            'It does not ask for, store or transmit your Instagram username, password or session cookies.',
            'It does not bypass authentication, privacy settings, paywalls or technical access controls.',
            'It does not host a library of downloaded media or re-publish Instagram content.',
            'It does not add watermarks, and it does not claim to remove watermarks that a creator placed in the original video.',
            'It does not provide unlimited or guaranteed capacity: per-IP rate limits protect the service from abuse.',
            'It does not guarantee that every link will succeed. Availability depends on Instagram, the media type and the public state of the post.',
          ],
        },
      ],
    },
    {
      id: 'usability',
      heading: 'Designed for clarity',
      blocks: [
        {
          type: 'p',
          text: 'The downloader is intentionally small: a labelled URL field, a Paste button, a Download button, and a result card with one clear action per quality. Buttons are keyboard reachable, text is presented at readable sizes, and the layout adapts to narrow screens.',
        },
        {
          type: 'p',
          text: 'We avoid countdown timers, fake progress percentages, auto-starting downloads and pop-ups. If something fails, the page shows the reason in text so you can decide what to do next. If a message on this site is unclear or inaccurate, we want to know.',
        },
      ],
    },
    {
      id: 'privacy',
      heading: 'Our approach to privacy',
      blocks: [
        {
          type: 'p',
          text: 'Using the downloader does not require an account, and we do not build a history of the links people submit. Links are processed in the request that you send; the page keeps the last link in memory so the preview can be refreshed, and that value disappears when you reload or close the page.',
        },
        {
          type: 'p',
          text: 'Two things are worth stating plainly, because generic "we collect nothing" claims are rarely true for any website: our infrastructure provider processes standard request data (such as IP address and user agent) to deliver and protect the site, and we use Google Analytics 4 to understand aggregate usage. Both are described, with the controls available to you, in our [Privacy Policy](/privacy).',
        },
      ],
    },
    {
      id: 'independent',
      heading: 'Independent status and trademarks',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo is not affiliated with Instagram, Meta Platforms, Inc. or any of their subsidiaries. "Instagram", "Reels", "IGTV" and related names and logos are trademarks of their respective owners and are used here only to describe the platform whose public links the tool accepts.',
        },
        {
          type: 'p',
          text: 'Content processed through the tool remains the property of its creators and rights holders. IGSaveGo claims no ownership over it and grants you no additional rights to reuse it. See the [Disclaimer](/disclaimer) and [Terms of Use](/terms).',
        },
      ],
    },
    {
      id: 'feedback',
      heading: 'Feedback and corrections',
      blocks: [
        {
          type: 'p',
          text: 'Bug reports, unclear instructions and factual corrections are genuinely useful. Write to {email} with the page or link involved and what you expected to happen. For copyright or privacy matters, the [Contact page](/contact) lists the details we need so a request can be handled without a long back-and-forth.',
        },
      ],
    },
  ],
  related: relatedFor('about'),
};

const CONTACT: InfoPage = {
  id: 'contact',
  path: '/contact',
  title: 'Contact IGSaveGo — Support, Feedback and Copyright',
  description:
    'How to reach IGSaveGo about download errors, website feedback, copyright concerns or privacy questions, and what to include in your message.',
  h1: 'Contact IGSaveGo',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'Email is the supported contact channel for IGSaveGo. This page explains what to include so your message can be answered without a long exchange.',
    'There is no contact form on this website today. Nothing is submitted through this page itself: the address below opens your own email application, and your message is delivered only when you send it.',
  ],
  sections: [
    {
      id: 'email',
      heading: 'Email address',
      blocks: [
        { type: 'email' },
        {
          type: 'p',
          text: 'Use a clear subject line, for example "Download error — Reel link" or "Copyright notice — post URL". Messages sent to this address are handled under the notice at the end of this page.',
        },
      ],
    },
    {
      id: 'technical',
      heading: 'Technical problems and download errors',
      blocks: [
        {
          type: 'p',
          text: 'If a download fails, the page usually shows a short reason such as "Invalid Instagram URL", "Media not found" or "Rate limit exceeded". Include that exact text, plus:',
        },
        {
          type: 'list',
          items: [
            'The Instagram link you used (it is public, so it can be shared, but avoid sending anyone else\'s private information).',
            'The error message shown on the page and, if possible, a screenshot.',
            'Your browser and version, and your device type (Android phone, iPhone, Windows desktop, macOS, and so on).',
            'The approximate time of the attempt and your time zone.',
            'Whether the same link worked before, and whether another link works now.',
          ],
        },
        {
          type: 'p',
          text: 'Many failures are caused by the post being private or deleted, by a story or highlight link, or by temporary Instagram rate limiting. The [How to Use](/how-to-use) page covers the common cases before you write to us.',
        },
      ],
    },
    {
      id: 'feedback',
      heading: 'Website feedback and suggestions',
      blocks: [
        {
          type: 'p',
          text: 'Comments on clarity, accessibility, translations, page layout or missing explanations are welcome. Tell us the page address, what you expected, and what happened instead. If a sentence on this site is inaccurate, say which page and quote the sentence; corrections to factual statements are prioritised.',
        },
      ],
    },
    {
      id: 'copyright',
      heading: 'Copyright and intellectual-property concerns',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo does not host, index or archive Instagram media. The tool resolves links on request and streams the file to the person who asked for it. If you believe the service is being used to infringe your rights, write to the address above with:',
        },
        {
          type: 'list',
          items: [
            'Identification of the work you own or represent.',
            'The Instagram link or IGSaveGo page involved, with enough detail to locate it.',
            'Your name, organisation (if any) and a reply address.',
            'A statement that you have a good-faith belief that the use is not authorised.',
            'A statement that the information is accurate and that you are the rights holder or authorised to act for them.',
          ],
        },
        {
          type: 'p',
          text: 'We may ask for clarification or evidence of authority before acting, and we may limit or block processing of a specific link while a concern is reviewed. This page is not a substitute for formal legal notice under your local law, and IGSaveGo does not claim registration as a designated agent in any jurisdiction.',
        },
      ],
    },
    {
      id: 'privacy-questions',
      heading: 'Privacy questions',
      blocks: [
        {
          type: 'p',
          text: 'For questions about the [Privacy Policy](/privacy), or to ask about access, correction or deletion of information you have sent us, use the same address. Because the downloader does not require an account, we may not hold any record that identifies you; if we cannot locate a record, we will say so rather than guess.',
        },
      ],
    },
    {
      id: 'general',
      heading: 'General inquiries',
      blocks: [
        {
          type: 'p',
          text: 'For press, partnership or general questions, describe what you need and the timeline. IGSaveGo is an independent project and does not offer paid placement, sponsored rankings or guaranteed inclusion in its guides.',
        },
      ],
    },
    {
      id: 'do-not-send',
      heading: 'What not to send',
      blocks: [
        {
          type: 'list',
          items: [
            'Your Instagram password, two-factor codes, session cookies or API keys. We never need them and will never ask for them.',
            'Payment card numbers or government identifiers. The service is free and does not process payments.',
            'Private information about another person, including private account content, addresses or identity documents.',
          ],
        },
      ],
    },
    {
      id: 'notice',
      heading: 'How messages are handled',
      blocks: [
        {
          type: 'note',
          text: 'Information you send by email — your address, name if you give one, and the contents of the message — is used to answer you and to keep a record of the request. It is not sold. It may be stored in the mailbox of our email provider and retained for as long as needed to handle the matter and meet legal obligations. Please do not include sensitive personal data that is not needed for your request. Full details are in the [Privacy Policy](/privacy).',
        },
      ],
    },
  ],
  related: relatedFor('contact'),
};

const HOW_TO_USE: InfoPage = {
  id: 'how-to-use',
  path: '/how-to-use',
  title: 'How to Use IGSaveGo — Step-by-Step Instagram Download Guide',
  description:
    'A practical guide to copying an Instagram link, pasting it into IGSaveGo, downloading the result, finding the file, and fixing common errors.',
  h1: 'How to use IGSaveGo',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'This guide follows the actual interface: the tool tabs, the link field, the Paste and Download buttons, and the result card. It should take about a minute the first time and a few seconds afterwards.',
    'Before you start, make sure the post is public and that you have the right to save it. A public post is not automatically free to reuse — see [Copyright and responsible use](#responsible-use) below.',
  ],
  sections: [
    {
      id: 'step-1',
      heading: 'Step 1 — Find the post, Reel or photo in Instagram',
      blocks: [
        {
          type: 'p',
          text: 'Open Instagram in the app or in a browser and navigate to the public post you want to save. This can be a video post, a Reel, an IGTV video or a photo. For a carousel, the tool returns the media it can resolve for the post.',
        },
        {
          type: 'p',
          text: 'The post must be visible without logging in. If Instagram asks you to follow the account or shows "This account is private", the tool cannot process it.',
        },
      ],
    },
    {
      id: 'step-2',
      heading: 'Step 2 — Copy the link',
      blocks: [
        {
          type: 'p',
          text: 'In the Instagram app, tap the Share icon (the paper-plane) below the post, then choose "Copy link". On a computer, copy the address from the browser bar. The link normally looks like one of these:',
        },
        {
          type: 'list',
          items: [
            'https://www.instagram.com/p/SHORTCODE/',
            'https://www.instagram.com/reel/SHORTCODE/',
            'https://www.instagram.com/tv/SHORTCODE/',
            'A share link that contains /share/reel/ or /share/p/ — these are accepted when the shortcode is present.',
          ],
        },
        {
          type: 'p',
          text: 'Story page links (instagram.com/stories/…) and highlight links are not supported by the current extractor. They return an "Invalid Instagram URL" message.',
        },
      ],
    },
    {
      id: 'step-3',
      heading: 'Step 3 — Open IGSaveGo and choose a tab',
      blocks: [
        {
          type: 'p',
          text: 'Go to the [homepage](/) or the matching tool page. The tab row above the input switches between Video, Reels, Photo, Story and Highlights. The tab changes the page you are on and the metadata around the tool; the link itself is what determines which media is returned, so a Reel link works from the Video tab as well.',
        },
      ],
    },
    {
      id: 'step-4',
      heading: 'Step 4 — Paste the link',
      blocks: [
        {
          type: 'p',
          text: 'Click inside the field labelled "Insert Instagram link here…" and paste, or press the Paste button to insert the clipboard contents. On a keyboard, Ctrl+V (Windows/Linux) or Command+V (macOS) also works. If clipboard access is blocked by your browser, the page asks you to paste manually instead of filling in an example link.',
        },
      ],
    },
    {
      id: 'step-5',
      heading: 'Step 5 — Press Download and wait for the result',
      blocks: [
        {
          type: 'p',
          text: 'Press the Download button. While the server resolves the link, the button shows a spinner and the text "Fetching…". Processing usually takes a few seconds, but it can take longer when Instagram is slow or when fallback providers are used.',
        },
        {
          type: 'p',
          text: 'If the request fails, a red message appears above the sample links with the reason and a retry button. The message stays on the page until the next attempt, so you can read it or screenshot it for support.',
        },
      ],
    },
    {
      id: 'step-6',
      heading: 'Step 6 — Review the result and download the file',
      blocks: [
        {
          type: 'p',
          text: 'A result card appears below the input with a preview, the author name, the media type and the available quality. Choose the download action for the quality you want. For videos, the MP4 is delivered with range support so the preview can seek; for photos, the JPG is delivered at the quality Instagram exposes.',
        },
        {
          type: 'p',
          text: 'Use "Download Another" to clear the result and process a different link. If a preview stops working because the temporary CDN link expired, use the refresh action on the card instead of reloading the page: the site re-runs the extraction for the last link you submitted.',
        },
      ],
    },
    {
      id: 'step-7',
      heading: 'Step 7 — Find the downloaded file',
      blocks: [
        {
          type: 'list',
          items: [
            'Windows and Linux: the default Downloads folder, unless your browser asks where to save.',
            'macOS: the Downloads folder, or the location chosen in Safari or Chrome settings.',
            'Android: the Downloads folder; some browsers also offer "Save to Photos" or a share sheet after the download.',
            'iPhone and iPad: Safari saves to the Files app under Downloads; a browser may offer "Save Image" or "Save Video" to Photos.',
          ],
        },
        {
          type: 'p',
          text: 'The file name starts with igsavego_ and includes the shortcode and author where available, which makes it easier to find later.',
        },
      ],
    },
    {
      id: 'troubleshooting',
      heading: 'Troubleshooting',
      blocks: [
        {
          type: 'table',
          head: ['What you see', 'What it means', 'What to try'],
          rows: [
            [
              'Invalid Instagram URL',
              'The link does not contain a post, Reel or IGTV shortcode, or it is a story/highlight link.',
              'Copy the link again from the post itself. Use /p/, /reel/ or /tv/ links.',
            ],
            [
              'Media not found. The post is private, deleted, or all free providers are busy',
              'Instagram did not expose the media: the account is private, the post was removed, or upstream is rate limiting us.',
              'Confirm the post opens in a private browser window without logging in. Retry after a minute.',
            ],
            [
              'Too many requests. Please wait a minute.',
              'The per-IP limit for extraction (60 requests per minute) was reached.',
              'Wait a minute and try again. Avoid scripted or bulk requests.',
            ],
            [
              'CDN fetch failed or "link may have expired"',
              'The temporary Instagram CDN link behind the preview expired or was rejected.',
              'Use the refresh action on the result card to mint a fresh link, then download.',
            ],
            [
              'A video post returns a photo',
              'Instagram exposed only the cover image for that request, or the video stream was unavailable.',
              'Retry the link; the result card shows a note when this happens.',
            ],
            [
              'The page loads but the button does nothing',
              'The URL field is empty or the browser blocked the request.',
              'Paste a link first, check the browser console/network panel, then try another browser.',
            ],
          ],
        },
      ],
    },
    {
      id: 'compatibility',
      heading: 'Browsers and devices',
      blocks: [
        {
          type: 'p',
          text: 'The site is a modern JavaScript application and targets current versions of Chrome, Edge, Firefox, Safari and their mobile counterparts. It works on phones, tablets and desktop computers with no installation. Very old browsers that do not support modern JavaScript modules may not render the downloader.',
        },
        {
          type: 'p',
          text: 'Downloads are handled by your browser. If your device has little free storage, a large video may fail to save even though the preview works; free space and try again.',
        },
      ],
    },
    {
      id: 'responsible-use',
      heading: 'Copyright and responsible use',
      blocks: [
        {
          type: 'p',
          text: 'Only download content you own, content you have permission to save, or content whose licence allows it. Being able to view a public post does not give you the right to republish it, use it commercially, or remove attribution.',
        },
        {
          type: 'p',
          text: 'Do not use IGSaveGo to harass anyone, to collect private information, to bypass privacy settings, or to build a redistributed library of other people\'s work. See the [Terms of Use](/terms) and [Disclaimer](/disclaimer) for the rules that apply, and the [Privacy Policy](/privacy) for what happens to the link you submit.',
        },
      ],
    },
  ],
  related: relatedFor('how-to-use'),
};

const FAQ_ITEMS = [
  {
    question: 'What is IGSaveGo?',
    answer:
      'IGSaveGo is a free web tool that saves publicly available Instagram videos, Reels, photos and IGTV posts to your device. You paste a link, the server resolves the public media, and your browser downloads the file. There is no account and nothing to install.',
  },
  {
    question: 'Is IGSaveGo free?',
    answer:
      'Yes. The downloader is free to use and does not require a subscription, payment or account. Per-IP rate limits apply to keep the service available, and the site is supported by the operator rather than by charging visitors.',
  },
  {
    question: 'Which Instagram links are supported?',
    answer:
      'Public post links (/p/), Reel links (/reel/), IGTV links (/tv/) and share links that contain one of those shortcodes. A bare shortcode also works. Story page links (/stories/…) and highlight links are not currently supported and return an "Invalid Instagram URL" message.',
  },
  {
    question: 'How do I download a video?',
    answer:
      'Copy the link from the post\'s Share menu, paste it into the field on the homepage, press Download, wait for the result card, then choose the download action for the quality you want. The step-by-step guide covers each stage in detail.',
  },
  {
    question: 'Can I use IGSaveGo on a phone?',
    answer:
      'Yes. The interface is responsive and works in mobile browsers on Android and iOS. The file is saved by your browser: on Android it normally goes to Downloads; on iPhone and iPad it goes to the Files app under Downloads, and Safari may offer to save it to Photos.',
  },
  {
    question: 'Why is my link not working?',
    answer:
      'The most common reasons are a story or highlight link, a private or deleted post, a typo in the shortcode, or a temporary rate limit. The error message on the page names the cause; the troubleshooting table in the guide lists each message and the fix.',
  },
  {
    question: 'Can I download content from private accounts?',
    answer:
      'No. IGSaveGo only processes publicly visible content. It does not log in, does not accept Instagram credentials, and does not bypass privacy settings or access controls.',
  },
  {
    question: 'What happens when a post is deleted or unavailable?',
    answer:
      'The extraction fails with a "Media not found" message because Instagram no longer exposes the media. Nothing is cached on our side that could be used to recover it.',
  },
  {
    question: 'Where are downloaded files saved?',
    answer:
      'Wherever your browser saves downloads: usually the Downloads folder on desktop and Android, and the Files app under Downloads on iPhone and iPad. The file name begins with igsavego_ followed by the shortcode and author.',
  },
  {
    question: 'Does IGSaveGo store the links I submit or the media I download?',
    answer:
      'The link is processed in the request and is not written to our database; the page keeps the last link in memory only so the preview can be refreshed. Media is streamed through our proxy and is not stored on our origin storage, although our CDN provider may keep a temporary edge copy. The Privacy Policy describes exactly what is retained and for how long.',
  },
  {
    question: 'Is IGSaveGo affiliated with Instagram or Meta?',
    answer:
      'No. IGSaveGo is an independent project and is not affiliated with, endorsed by or sponsored by Instagram or Meta Platforms, Inc. Their names and trademarks belong to their owners and are used only to describe the platform.',
  },
  {
    question: 'Can I repost or use downloaded content commercially?',
    answer:
      'Only if you own the content or have permission or a licence that allows it. Downloading does not transfer rights, and public visibility does not imply permission. You are responsible for how you use the file.',
  },
  {
    question: 'How do I report a copyright concern?',
    answer:
      'Email us with the work you own or represent, the link involved, your contact details, and a good-faith statement. The Contact page lists the full set of details we need and explains how such messages are handled.',
  },
  {
    question: 'How can I contact support?',
    answer:
      'Use the email address on the Contact page. There is no contact form on this site and no chat widget, so your message is delivered by your own email application. Include the page or link involved, the exact error text, your browser and device, and your time zone so the issue can be reproduced.',
  },
  {
    question: 'Does IGSaveGo show ads?',
    answer:
      'Not at the moment. The site does not load Google AdSense or any third-party advertising script, and the advertising slots in the admin panel are switched off. If advertising is introduced, the Privacy Policy will be updated before it goes live.',
  },
];

const FAQ: InfoPage = {
  id: 'faq',
  path: '/faq',
  title: 'IGSaveGo FAQ — Instagram Downloader Questions Answered',
  description:
    'Answers about supported Instagram links, free use, private accounts, file locations, rate limits, data retention, copyright and contact options.',
  h1: 'Frequently asked questions',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'These answers describe how IGSaveGo actually behaves today. If an answer here and a message in the interface ever disagree, the interface message is what the service returned — please report the mismatch so it can be corrected.',
  ],
  sections: [],
  faqs: FAQ_ITEMS,
  related: relatedFor('faq'),
};

const PRIVACY: InfoPage = {
  id: 'privacy',
  path: '/privacy',
  title: 'Privacy Policy — IGSaveGo',
  description:
    'What IGSaveGo processes when you use the downloader, which cookies and analytics are active, how long data is kept, and the choices available to you.',
  h1: 'Privacy Policy',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'This policy explains what happens to information when you visit www.igsavego.com and use the Instagram downloader. It is written to match the current implementation rather than a generic template, and it is reviewed when the service changes.',
    'In short: you do not need an account, we do not keep a history of the links you submit, and we do not sell personal information. Our hosting provider processes standard request data to deliver the site, and Google Analytics 4 measures aggregate usage. Those two facts are explained in detail below.',
  ],
  sections: [
    {
      id: 'scope',
      heading: '1. Scope',
      blocks: [
        {
          type: 'p',
          text: 'This policy applies to IGSaveGo at www.igsavego.com, including the downloader, the guides, and the informational pages. It does not apply to Instagram or to any other website you reach from a link. Those services have their own policies.',
        },
      ],
    },
    {
      id: 'information-you-provide',
      heading: '2. Information you provide',
      blocks: [
        {
          type: 'list',
          items: [
            'Instagram links you paste into the downloader. These are needed to resolve the media you asked for.',
            'Messages you send to our contact address, including your email address, name if you include it, and the content of the message.',
            'Nothing else is required. There is no registration form, no payment flow, and no newsletter.',
          ],
        },
      ],
    },
    {
      id: 'links',
      heading: '3. How submitted Instagram links are processed',
      blocks: [
        {
          type: 'p',
          text: 'When you press Download, your browser sends the link to /api/extract on this domain. The server reads the shortcode from the link and makes outbound requests to Instagram\'s public endpoints and, when needed, to fallback providers that relay the same public content. The response contains the media information, including the link you submitted, which is returned to your browser so the page can show what was processed.',
        },
        {
          type: 'p',
          text: 'The extraction code does not write the link, the result or the media to our database, and we do not keep a per-user download history. The page keeps the most recent link in memory (browser JavaScript) so that an expired preview can be refreshed; that value is discarded when you reload or close the page.',
        },
        {
          type: 'p',
          text: 'The request necessarily passes through our hosting provider and may appear in its request logs, which record the requested URL along with standard technical data. Those logs are controlled by the provider\'s configuration rather than by the application.',
        },
      ],
    },
    {
      id: 'logs',
      heading: '4. Server logs, IP addresses and security data',
      blocks: [
        {
          type: 'p',
          text: 'Our site is delivered through Cloudflare, which processes technical data such as your IP address, user agent, requested URL, referrer and timestamps in order to route requests, apply TLS, block abuse and keep the service available. Cloudflare acts as our infrastructure provider and handles that data under its own privacy terms and the account settings we choose.',
        },
        {
          type: 'p',
          text: 'To prevent abuse, the extraction and media endpoints keep a short-lived rate-limit counter in the memory of the server instance handling your request. The counter is keyed by a truncated client IP address and a scope name, holds a count for a 60-second window, and is not written to a database or used to build a profile. It is discarded when the window expires or the instance is recycled.',
        },
        {
          type: 'p',
          text: 'We do not operate an application-level log of individual downloads, and the admin dashboard does not display a visitor history. We cannot verify or control every log retained by our infrastructure provider, so this policy does not claim that no request is ever logged anywhere.',
        },
      ],
    },
    {
      id: 'media',
      heading: '5. Media files and caching',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo does not store downloaded videos or photos in its own storage. The media proxy streams the file from Instagram\'s CDN to your browser. The proxy response carries a cache header that allows our CDN provider to keep a temporary edge copy for up to 24 hours, which reduces repeated transfers; that copy is held by the CDN, not in a media library, and is not listed or searchable on this site.',
        },
        {
          type: 'p',
          text: 'Your browser, your device and any intermediary network may also cache the file according to their own settings. Clearing your browser cache removes the local copy.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: '6. Cookies and local storage',
      blocks: [
        {
          type: 'p',
          text: 'The downloader itself does not set cookies. The site stores a small number of settings in your browser\'s local storage so the interface and admin panel behave consistently: branding and interface settings, SEO/tracking configuration, advertising configuration and API configuration. These values contain site configuration, not your browsing history or Instagram credentials. They are created on your device and can be removed by clearing site data for this domain.',
        },
        {
          type: 'p',
          text: 'The language you select is held in page state while the page is open; it is not written to a cookie. Google Analytics sets its own cookies, described in the next section.',
        },
      ],
    },
    {
      id: 'analytics',
      heading: '7. Analytics',
      blocks: [
        {
          type: 'p',
          text: 'We use Google Analytics 4 (measurement ID G-LWXLE5CQD4) to understand aggregate traffic: which pages are visited, approximate country, device and browser type, and how visitors move through the site. Google acts as a service provider for this measurement. Google states that Analytics 4 does not log or store individual IP addresses; it uses the IP address to derive coarse location and then discards it.',
        },
        {
          type: 'p',
          text: 'Google Analytics sets first-party cookies such as _ga and _ga_<container-id>, which normally expire after up to two years, to distinguish browsers. The retention period for event data is configured in our Analytics property. You can block or delete these cookies in your browser, use Google\'s Analytics opt-out browser add-on, or use a content blocker; the downloader continues to work without them.',
        },
        {
          type: 'p',
          text: 'Where local law requires consent for analytics cookies, you can refuse them using those controls. We do not currently run a separate consent-management banner; if that changes, this section will be updated with the choices it provides. Blocking analytics does not restrict any feature of the site.',
        },
        {
          type: 'p',
          text: 'Google\'s privacy practices are described at [policies.google.com/privacy](https://policies.google.com/privacy).',
        },
      ],
    },
    {
      id: 'advertising',
      heading: '8. Advertising and Google AdSense',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo does not currently display advertising and does not load the Google AdSense script. The advertising slots configured in our admin panel are switched off, and no advertising cookies are set by this site today.',
        },
        {
          type: 'p',
          text: 'Advertising may be introduced in the future. If it is, this policy will be updated before ads go live, and the site will identify the advertising vendors and the choices available to you. Third-party vendors, including Google where applicable, may then use cookies or similar technologies to serve, measure, limit or personalise advertisements as permitted by their settings and by applicable requirements. Google\'s explanation of how it uses information from partner sites is available at [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).',
        },
        {
          type: 'p',
          text: 'Ads, if introduced, will not be placed to resemble download controls, and the actual download buttons will remain visually distinct.',
        },
      ],
    },
    {
      id: 'third-parties',
      heading: '9. Third-party services',
      blocks: [
        {
          type: 'p',
          text: 'The following categories of providers may process data in connection with your use of the site:',
        },
        {
          type: 'list',
          items: [
            'Cloudflare — hosting, content delivery, TLS and abuse protection for this domain.',
            'Instagram and Meta — the source of the public media that the downloader resolves.',
            'Fallback extraction providers — services that relay publicly available Instagram metadata when Instagram does not respond to our direct requests. They receive the public link being processed, not your identity.',
            'Google Analytics — aggregate usage measurement, as described above.',
            'Cloudflare or another email provider — storage and delivery of messages you send to our contact address.',
            'Optional operator-configured services — if the operator enables a RapidAPI key or a self-hosted Cobalt endpoint, the public link is sent to that service to resolve the media. These integrations are off unless configured.',
          ],
        },
        {
          type: 'p',
          text: 'We do not control the privacy practices of third-party platforms. Review their policies before using their services.',
        },
      ],
    },
    {
      id: 'sharing',
      heading: '10. Data sharing and sale',
      blocks: [
        {
          type: 'p',
          text: 'We do not sell personal information, and we do not share it for cross-context behavioural advertising while advertising is disabled. Data is shared only with the service providers needed to run the site, when required by law or a valid legal request, or to protect the service and its users from abuse. If the project is transferred, information held in our email correspondence may be transferred as part of that transfer, subject to this policy.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '11. Retention',
      blocks: [
        {
          type: 'table',
          head: ['Data', 'Where it lives', 'Retention'],
          rows: [
            ['Submitted Instagram link', 'Browser memory and the live request; returned in the API response', 'Until you reload or close the page; request metadata may appear in provider logs'],
            ['Rate-limit counter', 'Server memory of the instance handling the request', 'Up to 60 seconds per window'],
            ['Streamed media', 'Not stored on our origin; temporary CDN edge cache', 'Up to 24 hours at the CDN, subject to provider behaviour'],
            ['Analytics events', 'Google Analytics property', 'Per the property\'s configured retention period'],
            ['Contact emails', 'Our email provider and mailbox', 'As long as needed to handle the request and keep necessary records'],
          ],
        },
      ],
    },
    {
      id: 'security',
      heading: '12. Security',
      blocks: [
        {
          type: 'p',
          text: 'Traffic to the site is encrypted in transit with TLS. Administrative access to site settings requires authentication, and the extraction and media endpoints restrict which upstream hosts they will contact. No service can promise absolute security; if you discover a vulnerability, please report it to {email} with enough detail to reproduce it, and do not test it against other users or at scale.',
        },
      ],
    },
    {
      id: 'rights',
      heading: '13. Your choices and rights',
      blocks: [
        {
          type: 'p',
          text: 'Depending on where you live, you may have the right to request access to, correction of, or deletion of personal information, to object to or restrict certain processing, to withdraw consent, or to lodge a complaint with your local data-protection authority. You can exercise these choices by writing to {email}.',
        },
        {
          type: 'p',
          text: 'Because the downloader does not require an account, we often cannot link a request to a specific person. In that case we will explain what we can and cannot locate rather than ask you for more information than is needed. This policy describes our practices; it is not a certification of compliance with any particular privacy framework.',
        },
      ],
    },
    {
      id: 'international',
      heading: '14. International transfers',
      blocks: [
        {
          type: 'p',
          text: 'Our providers operate globally, so technical data may be processed in countries other than the one you are in. Where required, transfers rely on the safeguards offered by those providers, such as standard contractual clauses.',
        },
      ],
    },
    {
      id: 'children',
      heading: '15. Children\'s privacy',
      blocks: [
        {
          type: 'p',
          text: 'The site is not directed to children under 13 (or under 16 where local law sets that threshold), and it does not create accounts or knowingly collect personal information from children. If you believe a child has sent us personal information, contact {email} and we will delete it.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '16. Changes to this policy',
      blocks: [
        {
          type: 'p',
          text: 'This policy may be updated when the service, the providers or the law change. The revision date at the top of the page shows when it was last revised. Material changes will be reflected on this page before they take effect.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '17. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Questions or requests about privacy can be sent to {email}. The [Contact page](/contact) explains what to include and how messages are handled.',
        },
      ],
    },
  ],
  related: relatedFor('privacy'),
};

const TERMS: InfoPage = {
  id: 'terms',
  path: '/terms',
  title: 'Terms of Use — IGSaveGo',
  description:
    'The rules that apply when you use IGSaveGo: acceptable use, content rights, prohibited activity, availability, liability and contact details.',
  h1: 'Terms of Use',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'These Terms of Use ("Terms") govern your use of www.igsavego.com and the downloader it provides. By using the site, you agree to them. If you do not agree, please do not use the service.',
    'IGSaveGo is a free utility for saving publicly accessible Instagram media. It is independent from Instagram and Meta, and it does not grant you rights to content you do not own.',
  ],
  sections: [
    {
      id: 'service',
      heading: '1. The service',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo accepts a public Instagram link, resolves the media associated with it, and streams the file to your browser. The service is provided free of charge, without an account, and without any guarantee of availability or fitness for a particular purpose.',
        },
        {
          type: 'p',
          text: 'The service is not affiliated with, endorsed by or sponsored by Instagram or Meta Platforms, Inc. References to Instagram are descriptive only.',
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: '2. Acceptable use',
      blocks: [
        {
          type: 'p',
          text: 'You may use IGSaveGo for personal, lawful purposes. By using it, you confirm that you will respect the rights of content owners, the privacy of other people, and the terms that apply to the platform you are downloading from.',
        },
        {
          type: 'p',
          text: 'You are responsible for deciding whether you have the right to download, keep, share or reuse a file. A post being publicly visible does not mean it is free to copy or republish, and these Terms do not give you that permission.',
        },
      ],
    },
    {
      id: 'prohibited',
      heading: '3. Prohibited uses',
      blocks: [
        {
          type: 'list',
          items: [
            'Downloading or attempting to access private, login-protected or otherwise restricted content, or bypassing privacy settings or access controls.',
            'Using the service to infringe copyright, trademarks or other rights, or to remove attribution or ownership notices.',
            'Harassing, stalking, doxxing or targeting any person, or collecting information about them without a lawful basis.',
            'Automated, scripted or bulk requests that exceed the published rate limits, or any attempt to overload, probe or disrupt the service.',
            'Attempting to access administrative areas, other users\' data, or systems without authorisation.',
            'Uploading or transmitting malware, or using the service for fraud, spam or any other unlawful activity.',
            'Reselling, rebranding or presenting the service as your own, or removing notices that identify IGSaveGo.',
          ],
        },
      ],
    },
    {
      id: 'content-rights',
      heading: '4. Content, copyright and third-party rights',
      blocks: [
        {
          type: 'p',
          text: 'All videos, photos and other media processed through IGSaveGo belong to their creators and rights holders. IGSaveGo does not claim ownership of that content, does not license it to you, and does not host a copy for redistribution.',
        },
        {
          type: 'p',
          text: 'If you are a rights holder and believe the service is being used to infringe your rights, the [Contact page](/contact) explains the information to include. We may limit or block processing of a specific link while a concern is reviewed.',
        },
      ],
    },
    {
      id: 'third-party',
      heading: '5. Third-party platforms and links',
      blocks: [
        {
          type: 'p',
          text: 'The service depends on Instagram\'s public endpoints and on third-party infrastructure. Your use of Instagram is governed by Instagram\'s own terms and policies. Links to external websites are provided for convenience; we do not control their content or practices and are not responsible for them.',
        },
      ],
    },
    {
      id: 'availability',
      heading: '6. Availability, changes and errors',
      blocks: [
        {
          type: 'p',
          text: 'The service is provided on an "as is" and "as available" basis. Links can fail because a post was deleted, made private, restricted by Instagram, or because a provider is rate limiting or unavailable. Rate limits protect the service and may change.',
        },
        {
          type: 'p',
          text: 'We may modify, suspend or discontinue any part of the service, including supported link formats and tool tabs, without notice. We do not guarantee that a particular video quality, format or media type will be available.',
        },
      ],
    },
    {
      id: 'warranty',
      heading: '7. No warranties',
      blocks: [
        {
          type: 'p',
          text: 'To the extent permitted by law, IGSaveGo is provided without warranties of any kind, whether express or implied, including fitness for a particular purpose, non-infringement, accuracy or uninterrupted availability. Nothing in these Terms excludes rights that cannot lawfully be excluded, including mandatory consumer rights in your country of residence.',
        },
      ],
    },
    {
      id: 'liability',
      heading: '8. Limitation of liability',
      blocks: [
        {
          type: 'p',
          text: 'To the extent permitted by law, IGSaveGo and the people who operate it are not liable for indirect, incidental, special or consequential losses, loss of data, loss of profits, or losses arising from your use of downloaded content or from interruptions to the service. Where liability cannot be limited, it is limited to the smallest amount permitted by applicable law. Because the service is free, you should keep your own copies of anything important.',
        },
      ],
    },
    {
      id: 'governing-law',
      heading: '9. Governing law and legal notices',
      blocks: [
        {
          type: 'p',
          text: 'These Terms are governed by the laws applicable to the operator of IGSaveGo, without regard to conflict-of-law rules. Mandatory consumer-protection rules in your country of residence continue to apply. Legal notices should be sent to {email} with a clear subject line so they can be routed correctly.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '10. Changes to these Terms',
      blocks: [
        {
          type: 'p',
          text: 'We may update these Terms as the service changes. The revision date at the top of the page shows the current version. Continuing to use the site after an update means you accept the revised Terms.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '11. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Questions about these Terms can be sent to {email}. The [Contact page](/contact) also covers copyright concerns and privacy requests.',
        },
      ],
    },
  ],
  related: relatedFor('terms'),
};

const DISCLAIMER: InfoPage = {
  id: 'disclaimer',
  path: '/disclaimer',
  title: 'Disclaimer — IGSaveGo',
  description:
    'IGSaveGo is an independent tool with no affiliation to Instagram or Meta. What that means for trademarks, content ownership, availability and responsible use.',
  h1: 'Disclaimer',
  updated: INFO_PAGE_UPDATED,
  intro: [
    'This disclaimer explains the limits of what IGSaveGo is and does. It is written to be read, not to hide a policy issue behind legal wording.',
    'IGSaveGo is an independent utility. It is not affiliated with, endorsed by, sponsored by, authorised by or officially connected to Instagram or Meta Platforms, Inc.',
  ],
  sections: [
    {
      id: 'independent',
      heading: '1. Independent status',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo is operated independently. It does not represent Instagram or Meta, does not act on their behalf, and is not part of their services. Any support request about an Instagram account, post, suspension or privacy setting must be directed to Instagram.',
        },
      ],
    },
    {
      id: 'trademarks',
      heading: '2. Trademarks',
      blocks: [
        {
          type: 'p',
          text: '"Instagram", "Reels", "IGTV", the Instagram logo and related marks are trademarks or registered trademarks of Meta Platforms, Inc. or its affiliates. They are used on this site only to describe the platform whose public links the tool accepts. All other trademarks belong to their respective owners. Their use does not imply any endorsement or partnership.',
        },
      ],
    },
    {
      id: 'ownership',
      heading: '3. No ownership of third-party content',
      blocks: [
        {
          type: 'p',
          text: 'IGSaveGo does not claim ownership of any video, photo, audio or other media processed through the tool. Files remain the property of their creators and rights holders. The service does not host a searchable library of that content and does not license it to anyone.',
        },
      ],
    },
    {
      id: 'no-additional-rights',
      heading: '4. No additional rights are granted',
      blocks: [
        {
          type: 'p',
          text: 'Using the tool does not give you permission to download, copy, distribute, modify, republish or commercialise someone else\'s content. It also does not transfer any licence that the rights holder may have granted elsewhere. If you want to reuse a file, obtain permission from the rights holder or rely on a valid legal exception in your jurisdiction.',
        },
      ],
    },
    {
      id: 'responsibility',
      heading: '5. Your responsibility',
      blocks: [
        {
          type: 'p',
          text: 'You are responsible for how you use the service and the files you obtain. That includes compliance with copyright and related rights, privacy and personality rights, applicable platform terms, and any other law that applies to you. Do not use IGSaveGo to access private content, to monitor or harass a person, or to build a redistributed collection of other people\'s work.',
        },
      ],
    },
    {
      id: 'availability',
      heading: '6. Availability and accuracy',
      blocks: [
        {
          type: 'p',
          text: 'The tool depends on public endpoints and third-party infrastructure that can change without notice. A link may work today and fail tomorrow. We do not guarantee that any specific URL, media type, resolution or format will be available, and the information shown in a result card reflects what the upstream service returned at that moment.',
        },
      ],
    },
    {
      id: 'external',
      heading: '7. External links and services',
      blocks: [
        {
          type: 'p',
          text: 'Pages on this site may link to external websites, including Google\'s policy pages and Instagram. Those sites are outside our control. We are not responsible for their content, availability or data practices, and a link does not imply endorsement.',
        },
      ],
    },
    {
      id: 'not-legal-advice',
      heading: '8. Not legal advice',
      blocks: [
        {
          type: 'p',
          text: 'The information on this site is provided for general understanding of how the tool works. It is not legal advice. If you are unsure whether a particular use is lawful, consult a qualified professional in your jurisdiction.',
        },
      ],
    },
    {
      id: 'no-shield',
      heading: '9. This disclaimer does not remove legal obligations',
      blocks: [
        {
          type: 'p',
          text: 'A disclaimer does not make an unlawful use lawful, and it does not remove IGSaveGo\'s own obligations under applicable law. It also does not transfer responsibility for your actions to the site. It describes the limits of the service; it is not a permission slip.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '10. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Questions about this disclaimer, or copyright concerns, can be sent to {email}. See also the [Terms of Use](/terms) and [Privacy Policy](/privacy).',
        },
      ],
    },
  ],
  related: relatedFor('disclaimer'),
};

export const INFO_PAGES: Record<InfoPageId, InfoPage> = {
  about: ABOUT,
  contact: CONTACT,
  'how-to-use': HOW_TO_USE,
  faq: FAQ,
  privacy: PRIVACY,
  terms: TERMS,
  disclaimer: DISCLAIMER,
};

/** Returns the page content for a pathname, or null when it is not a static page. */
export function findInfoPage(pathname: string): InfoPage | null {
  const clean = (pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
  if (!clean.startsWith('/')) return null;
  const id = clean.slice(1) as InfoPageId;
  return (INFO_PAGE_IDS as readonly string[]).includes(id) ? INFO_PAGES[id] : null;
}

/**
 * Returns the page for a known id. Used by the router, which already resolved
 * the id from the pathname. Kept separate from findInfoPage() so a bare id can
 * never be mistaken for a pathname (that mistake rendered the wrong page once).
 */
export function infoPageById(id: InfoPageId | null | undefined): InfoPage | null {
  if (!id) return null;
  return (INFO_PAGE_IDS as readonly string[]).includes(id) ? INFO_PAGES[id] : null;
}

/** Small payload used by the edge middleware and sitemap builders. */
export const INFO_PAGE_SEO: { id: InfoPageId; path: string; title: string; description: string; updated: string }[] =
  INFO_PAGE_IDS.map((id) => ({
    id,
    path: INFO_PAGES[id].path,
    title: INFO_PAGES[id].title,
    description: INFO_PAGES[id].description,
    updated: INFO_PAGES[id].updated,
  }));
