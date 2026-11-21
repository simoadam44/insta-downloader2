import { GuideArticle, LanguageCode, MediaType } from '../types';

export const GUIDES_STORAGE_KEY = 'sss_guide_articles';

export const DEFAULT_GUIDES: GuideArticle[] = [
  {
    id: 'gd-ar-reels-iphone',
    slug: 'تحميل-ريلز-انستقرام-للايفون-بدون-برامج',
    lang: 'ar',
    keyword: 'تحميل ريلز انستقرام للايفون',
    tool: 'reels',
    title: 'تحميل ريلز انستقرام للايفون بدون برامج (2026) - خطوة بخطوة',
    metaDescription:
      'شرح تحميل ريلز انستقرام للايفون بدون برامج: انسخ الرابط من التطبيق، الصقه في IGSAVEGO، واحفظ الريل بجودة HD في صورك مباشرة.',
    h1: 'تحميل ريلز انستقرام للايفون بدون برامج',
    excerpt: 'دليل سريع لحفظ أي ريل على الايفون (Safari) بدون تثبيت تطبيقات: نسخ، لصق، تحميل.',
    sections: [
      {
        heading: '1. انسخ رابط الريل من تطبيق انستقرام',
        body: 'افتح الريل في تطبيق انستقرام على الايفون، اضغط زر المشاركة (السهم) ثم اختر "نسخ الرابط". تأكد أن الحساب عام لأن الريلز الخاصة لا يمكن تحميلها.',
      },
      {
        heading: '2. الصق الرابط في متصفح Safari',
        body: 'افتح موقع IGSAVEGO في Safari والصق الرابط في مربع البحث ثم اضغط زر التحميل. ستظهر معاينة الريل مع زر حفظ بجودة 1080p خلال ثوانٍ.',
      },
      {
        heading: '3. احفظ الريل في تطبيق الصور',
        body: 'اضغط "تحميل"، وعند انتهاء التنزيل اختر "حفظ في الصور" من قائمة المشاركة. ستجد الريل في ألبوم الكاميرا بجودته الأصلية وبدون علامة مائية.',
      },
    ],
    faqs: [
      {
        question: 'هل أحتاج تطبيقاً لتحميل ريلز انستقرام على الايفون؟',
        answer: 'لا. متصفح Safari مع موقع IGSAVEGO يكفي تماماً: نسخ الرابط ثم لصقه ثم التحميل، بدون تثبيت أي شيء.',
      },
      {
        question: 'أين يُحفظ الريل بعد التحميل على الايفون؟',
        answer: 'يُنزّل الملف أولاً إلى تطبيق "الملفات"، ومن قائمة المشاركة اختر "حفظ الفيديو" لينتقل إلى مكتبة الصور.',
      },
      {
        question: 'هل تحميل الريلز بهذه الطريقة آمن للحساب؟',
        answer: 'نعم، لا تدخل أي بيانات ولا تسجل الدخول. التحميل مجهول تماماً ولا يصل أي إشعار لصاحب الريل.',
      },
    ],
    relatedSlugs: ['حفظ-ستوري-انستقرام-بدون-ما-يدري', 'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية'],
    enabled: true,
  },
  {
    id: 'gd-ar-story-anon',
    slug: 'حفظ-ستوري-انستقرام-بدون-ما-يدري',
    lang: 'ar',
    keyword: 'حفظ ستوري انستقرام بدون ما يدري',
    tool: 'story',
    title: 'حفظ ستوري انستقرام بدون ما يدري صاحبها (مجهول 100%)',
    metaDescription:
      'طريقة حفظ ستوري انستقرام بدون ما يدري صاحب الحساب: أدخل اسم المستخدم، حمّل الستوري صوراً وفيديو بجودة عالية وبشكل مجهول تماماً.',
    h1: 'حفظ ستوري انستقرام بدون ما يدري',
    excerpt: 'احفظ أي ستوري عام بدون ظهور اسمك في قائمة المشاهدين: أدخل اليوزر وحمّل مباشرة.',
    sections: [
      {
        heading: 'لماذا لا يظهر اسمك؟',
        body: 'عند التحميل عبر IGSAVEGO لا تفتح الستوري من حسابك أصلاً. السيرفر يجلب نسخة عامة من ملفات انستقرام، فلا تُسجَّل مشاهدة باسمك أبداً ولا يصل أي إشعار لصاحب الحساب.',
      },
      {
        heading: 'خطوات حفظ الستوري',
        body: 'اختر تبويب Story من الأعلى، اكتب اسم المستخدم (username) بدون @، ثم اضغط تحميل. ستظهر الستوريات النشطة للحساب العام مع أزرار حفظ للصور والفيديو.',
      },
      {
        heading: 'شروط مهمة',
        body: 'الطريقة تعمل فقط مع الحسابات العامة. الحسابات الخاصة والستوريات المنتهية (بعد 24 ساعة) لا يمكن الوصول إليها احتراماً للخصوصية.',
      },
    ],
    faqs: [
      {
        question: 'هل يعرف صاحب الحساب أني حفظت الستوري؟',
        answer: 'لا. لا تظهر في قائمة المشاهدين ولا يصله أي تنبيه، لأن المشاهدة لا تتم من حسابك.',
      },
      {
        question: 'هل يمكن حفظ ستوري حساب خاص؟',
        answer: 'لا، وهذه حماية مقصودة للخصوصية. الأداة تدعم الحسابات العامة فقط.',
      },
      {
        question: 'بأي صيغة تُحفظ الستوري؟',
        answer: 'الصور بصيغة JPG والفيديو بصيغة MP4 بجودة تصل إلى 1080p.',
      },
    ],
    relatedSlugs: ['تحميل-ريلز-انستقرام-للايفون-بدون-برامج', 'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية'],
    enabled: true,
  },
  {
    id: 'gd-ar-android-video',
    slug: 'تحميل-فيديو-انستا-للاندرويد-بجودة-عالية',
    lang: 'ar',
    keyword: 'تحميل فيديو انستا للاندرويد',
    tool: 'video',
    title: 'تحميل فيديو انستا للاندرويد بجودة عالية MP4 (شرح مصور)',
    metaDescription:
      'شرح تحميل فيديو انستا للاندرويد بجودة 1080p: انسخ رابط الفيديو من التطبيق، الصقه في IGSAVEGO بمتصفح كروم، واحفظه في مجلد التنزيلات.',
    h1: 'تحميل فيديو انستا للاندرويد بجودة عالية',
    excerpt: 'احفظ أي فيديو عام على هاتفك الأندرويد بمتصفح كروم فقط: نسخ، لصق، تحميل MP4.',
    sections: [
      {
        heading: '1. نسخ رابط الفيديو',
        body: 'من تطبيق انستقرام افتح الفيديو، اضغط النقاط الثلاث أو زر المشاركة ثم "نسخ الرابط". يعمل هذا مع المنشورات والريلز على حد سواء.',
      },
      {
        heading: '2. التحميل من متصفح كروم',
        body: 'افتح IGSAVEGO في كروم والصق الرابط ثم اضغط تحميل. اختر جودة 1080p Full HD وسيبدأ التنزيل فوراً إلى مجلد Downloads في هاتفك.',
      },
      {
        heading: '3. تشغيل الفيديو بدون إنترنت',
        body: 'بعد اكتمال التحميل شغّل الملف بأي مشغّل فيديو. الملف بصيغة MP4 القياسية يعمل على كل الأجهزة ويمكن مشاركته عبر واتساب وتليجرام.',
      },
    ],
    faqs: [
      {
        question: 'أين أجد الفيديو بعد تحميله على الأندرويد؟',
        answer: 'في مجلد "التنزيلات" (Downloads) أو في تطبيق "ملفاتي"، ويمكنك نقله إلى الاستوديو.',
      },
      {
        question: 'هل يوجد حد لعدد الفيديوهات؟',
        answer: 'لا، التحميل غير محدود ومجاني بالكامل بدون حساب أو اشتراك.',
      },
      {
        question: 'لماذا يظهر الفيديو أحياناً كصورة؟',
        answer: 'بعض المنشورات لا يعرض إنستقرام لها رابط فيديو علناً، فيظهر الغلاف فقط. جرّب رابطاً آخر أو أعد المحاولة لاحقاً.',
      },
    ],
    relatedSlugs: ['تحميل-ريلز-انستقرام-للايفون-بدون-برامج', 'حفظ-ستوري-انستقرام-بدون-ما-يدري'],
    enabled: true,
  },
  {
    id: 'gd-en-reels-iphone',
    slug: 'download-instagram-reels-on-iphone-without-app',
    lang: 'en',
    keyword: 'download instagram reels on iPhone',
    tool: 'reels',
    title: 'How to Download Instagram Reels on iPhone Without an App (2026)',
    metaDescription:
      'Download Instagram Reels on iPhone without any app: copy the reel link, paste it into IGSAVEGO in Safari, and save it in HD to your Photos.',
    h1: 'Download Instagram Reels on iPhone Without an App',
    excerpt: 'Save any public reel on iPhone with Safari only: copy, paste, download in 1080p.',
    sections: [
      {
        heading: '1. Copy the reel link',
        body: 'Open the reel in the Instagram app, tap Share, then "Copy Link". The account must be public — private reels cannot be downloaded.',
      },
      {
        heading: '2. Paste it in Safari',
        body: 'Open IGSAVEGO in Safari, paste the link into the search box and hit Download. A preview appears within seconds with an HD save button.',
      },
      {
        heading: '3. Save to Photos',
        body: 'Tap Download, then use the share sheet to "Save Video". The reel lands in your camera roll in original quality with no watermark.',
      },
    ],
    faqs: [
      {
        question: 'Do I need an app to download reels on iPhone?',
        answer: 'No. Safari plus IGSAVEGO is enough — no installs, no sign-ups, no watermarks.',
      },
      {
        question: 'Where do downloaded reels go on iPhone?',
        answer: 'First to the Files app, then move them to Photos via the share sheet "Save Video" option.',
      },
      {
        question: 'Is it anonymous?',
        answer: 'Yes. No login is required and the reel owner is never notified.',
      },
    ],
    relatedSlugs: ['save-instagram-story-anonymously', 'download-instagram-photos-to-android-gallery'],
    enabled: true,
  },
  {
    id: 'gd-en-story-anon',
    slug: 'save-instagram-story-anonymously',
    lang: 'en',
    keyword: 'save instagram story anonymously',
    tool: 'story',
    title: 'How to Save an Instagram Story Anonymously (Viewer List Free)',
    metaDescription:
      'Save Instagram Stories anonymously without appearing on the viewer list: enter the username in IGSAVEGO and download story photos and videos in HD.',
    h1: 'Save Instagram Story Anonymously',
    excerpt: 'Download any public story without your name on the viewer list: just the username.',
    sections: [
      {
        heading: 'Why you stay invisible',
        body: 'You never open the story from your account. Our server fetches a public copy of the media files, so no view is registered under your name and the owner gets no notification.',
      },
      {
        heading: 'Steps to save a story',
        body: 'Switch to the Story tab, type the username without @, and hit download. Active stories of public accounts appear with save buttons for photos (JPG) and videos (MP4).',
      },
      {
        heading: 'Limitations',
        body: 'Only public accounts work. Private accounts and stories older than 24 hours are inaccessible by design, to respect privacy.',
      },
    ],
    faqs: [
      {
        question: 'Will they know I saved their story?',
        answer: 'No. You never appear on the viewer list and no notification is sent.',
      },
      {
        question: 'Can I save stories from private accounts?',
        answer: 'No — only public accounts are supported, as a deliberate privacy protection.',
      },
      {
        question: 'What format are saved stories?',
        answer: 'Photos as JPG and videos as MP4 in up to 1080p quality.',
      },
    ],
    relatedSlugs: ['download-instagram-reels-on-iphone-without-app', 'download-instagram-photos-to-android-gallery'],
    enabled: true,
  },
  {
    id: 'gd-en-photo-android',
    slug: 'download-instagram-photos-to-android-gallery',
    lang: 'en',
    keyword: 'download instagram photos to gallery',
    tool: 'photo',
    title: 'How to Download Instagram Photos to Your Android Gallery (HD)',
    metaDescription:
      'Download Instagram photos to your Android gallery in original HD quality: copy the post link, paste it into IGSAVEGO in Chrome, and save the JPG.',
    h1: 'Download Instagram Photos to Android Gallery',
    excerpt: 'Save any public photo or carousel to your Android phone with Chrome only.',
    sections: [
      {
        heading: '1. Copy the photo link',
        body: 'Open the post in Instagram, tap the three dots or Share, then "Copy Link". Works for single photos and multi-slide carousels.',
      },
      {
        heading: '2. Download in Chrome',
        body: 'Paste the link into IGSAVEGO, hit Download, and save each slide in original resolution JPG. Carousels are detected automatically with per-slide buttons.',
      },
      {
        heading: '3. Find it in your gallery',
        body: 'Files land in the Downloads folder. Move them to your gallery or DCIM folder, or open them directly with any gallery app.',
      },
    ],
    faqs: [
      {
        question: 'Can I download all carousel slides?',
        answer: 'Yes. Carousels are detected with individual HD download buttons per slide.',
      },
      {
        question: 'What quality are the photos?',
        answer: 'Original uploaded resolution in JPG, typically 1080px and up.',
      },
      {
        question: 'Is there a download limit?',
        answer: 'No limits — free and unlimited without an account.',
      },
    ],
    relatedSlugs: ['download-instagram-reels-on-iphone-without-app', 'save-instagram-story-anonymously'],
    enabled: true,
  },
  {
    id: 'gd-ar-story-private',
    slug: 'تحميل-ستوري-انستقرام-حساب-خاص',
    lang: 'ar',
    keyword: 'تحميل ستوري انستقرام حساب خاص',
    tool: 'story',
    title: 'تحميل ستوري انستقرام من حساب خاص - ما الذي يعمل فعلاً (2026)',
    metaDescription:
      'هل يمكن تنزيل ستوري حساب انستقرام خاص؟ نوضح حدود الخصوصية، وكيف تحفظ ستوري الحسابات العامة بجودة عالية وبدون ظهور اسمك في قائمة المشاهدين.',
    h1: 'تحميل ستوري انستقرام من حساب خاص',
    excerpt: 'الحقيقة عن الحسابات الخاصة، والطريقة العملية لحفظ ستوري أي حساب عام بدون أن يعرف صاحبه.',
    sections: [
      {
        heading: 'لماذا لا تُحمَّل الحسابات الخاصة؟',
        body: 'انستقرام لا تعرض وسائط الحساب الخاص إلا للمتابعين الموثّقين بعد تسجيل الدخول. أي موقع يدّعي تحميلها إما يطلب حسابك وكلمة مرورك - وهو خطر أمني حقيقي - أو يعيد صفحات فارغة. IGSaveGo لا يطلب بيانات دخول أبداً، لذلك لا يصل إلى محتوى خاص.',
      },
      {
        heading: 'ما الذي يمكنك حفظه فعلاً',
        body: 'كل ستوري من حساب عام متاح خلال 24 ساعة من نشره. في أداة الستوري، اكتب اسم المستخدم بدون علامة @، ثم اختر الصورة أو الفيديو واحفظه بصيغته الأصلية (JPG أو MP4).',
      },
      {
        heading: 'احفظ الستوري دون ظهور اسمك',
        body: 'التحميل يتم عبر خادمنا لا عبر حسابك، لذا لا يظهر اسمك في قائمة المشاهدين ولا يصل إشعار لصاحب الستوري. هذا هو الفرق بين الحفظ المجهول وفتح الستوري من تطبيقك.',
      },
    ],
    faqs: [
      {
        question: 'هل يمكن تحميل ستوري حساب خاص؟',
        answer: 'لا. الحسابات الخاصة محمية بتسجيل الدخول ولا يمكن لأي أداة خارجية الوصول إلى ستوريها، وأي موقع يطلب حسابك للقيام بذلك يعرّضك لخطر سرقة الحساب.',
      },
      {
        question: 'هل يعرف صاحب الحساب أنني حفظت الستوري؟',
        answer: 'لا، بالنسبة للحسابات العامة. لا تظهر في قائمة المشاهدين ولا يصل أي إشعار.',
      },
      {
        question: 'هل يمكن حفظ ستوري قديم أقدم من 24 ساعة؟',
        answer: 'لا، الستوري يختفي بعد 24 ساعة. المحتوى الدائم يُحفظ في الهايلايت، ويمكن تحميله من أداة الهايلايت.',
      },
    ],
    relatedSlugs: ['حفظ-ستوري-انستقرام-بدون-ما-يدري', 'حفظ-هايلايت-انستقرام-مع-الغلاف'],
    enabled: true,
  },
  {
    id: 'gd-ar-reels-mp3',
    slug: 'تنزيل-صوت-الريلز-انستقرام-mp3',
    lang: 'ar',
    keyword: 'تنزيل صوت ريلز انستقرام MP3',
    tool: 'reels',
    title: 'تنزيل صوت الريلز من انستقرام MP3 بجودة عالية - بدون فيديو',
    metaDescription:
      'استخرج صوت أي ريل انستقرام بصيغة MP3 بجودة عالية: الصق رابط الريل، اختر تحويل الصوت، واحفظ الأغنية على جوالك خلال ثوانٍ وبدون برامج.',
    h1: 'تنزيل صوت الريلز من انستقرام MP3',
    excerpt: 'حوّل أي ريل إلى ملف صوتي MP3 نظيف بدل حفظ الفيديو كاملاً.',
    sections: [
      {
        heading: '1. انسخ رابط الريل',
        body: 'اضغط زر المشاركة أسفل الريل في تطبيق انستقرام ثم اختر "نسخ الرابط". تأكد أن الحساب عام، لأن صوت الريلز الخاصة غير متاح.',
      },
      {
        heading: '2. الصق الرابط واختر الصوت',
        body: 'افتح أداة تحميل الريلز، الصق الرابط، ثم اختر خيار تحويل الصوت (MP3) من بطاقة النتيجة. التحويل يتم داخل متصفحك من مسار الفيديو الأصلي.',
      },
      {
        heading: '3. احفظ الملف',
        body: 'بعد انتهاء التحويل اضغط تنزيل ليُحفظ ملف MP3 في مجلد التنزيلات. الجودة تعتمد على الصوت الأصلي في الريل، ولا نرفعها صناعياً.',
      },
    ],
    faqs: [
      {
        question: 'هل يمكن تنزيل صوت الريل بدون حفظ الفيديو؟',
        answer: 'نعم. أداة الريلز تتيح تحويل مسار الصوت إلى MP3 وتحفظ الصوت وحده إن أردت.',
      },
      {
        question: 'هل الصوت بجودة أصلية؟',
        answer: 'الصوت يُستخرج من النسخة التي تعرضها انستقرام لتلك الريل، دون إعادة ترميز تضيف ضجيجاً.',
      },
      {
        question: 'هل يعمل مع كل الريلز؟',
        answer: 'مع الريلز العامة التي تحتوي مسار صوت. بعض الريلز تُنشر بمسار فيديو فقط، وحينها لا يوجد صوت لاستخراجه.',
      },
    ],
    relatedSlugs: ['تحميل-ريلز-انستقرام-للايفون-بدون-برامج', 'تحميل-ريلز-انستقرام-على-الاندرويد-بسرعة'],
    enabled: true,
  },
  {
    id: 'gd-ar-iphone-not-working',
    slug: 'تعذر-تحميل-فيديو-انستقرام-على-الايفون',
    lang: 'ar',
    keyword: 'تعذر تحميل فيديو انستقرام على الايفون',
    tool: 'video',
    title: 'حل مشكلة تعذر تحميل فيديو انستقرام على الايفون - 5 أسباب وحلول',
    metaDescription:
      'لم يعمل زر التحميل على الايفون؟ هذه أسباب مشكلة تعذر تنزيل فيديو انستقرام في Safari وكيف تحل كل سبب خلال دقيقة وتحفظ الفيديو في الصور.',
    h1: 'تعذر تحميل فيديو انستقرام على الايفون',
    excerpt: 'خمسة أسباب شائعة تمنع حفظ الفيديو في Safari، وحلّ كل واحد منها.',
    sections: [
      {
        heading: '1. الرابط ليس رابط منشور',
        body: 'إذا نسخت الرابط من شريط عنوان Safari أو من مشاركة الستوري فلن يعمل. افتح المنشور نفسه، اضغط أيقونة المشاركة، ثم "نسخ الرابط"، والصق الناتج في الأداة.',
      },
      {
        heading: '2. الحساب خاص أو المحتوى محذوف',
        body: 'المنشورات الخاصة لا يمكن تحميلها. كذلك إذا حُذف المنشور أو تغيّر اسم المستخدم بين النسخ واللصق ستظهر رسالة خطأ. جرّب فتح الرابط في متصفح عادي: إن لم يظهر فهو غير عام.',
      },
      {
        heading: '3. Safari يحفظ في الملفات لا في الصور',
        body: 'على iOS يُنزّل الملف أولاً إلى تطبيق الملفات. افتحه، اضغط مشاركة، ثم "حفظ الفيديو" لينتقل إلى مكتبة الصور. إذا كان زر التحميل لا يستجيب، جرّب تعطيل مانع الإعلانات لهذا الموقع أو استخدام شبكة أخرى.',
      },
    ],
    faqs: [
      {
        question: 'لماذا لا يفتح رابط التحميل على الايفون؟',
        answer: 'غالباً لأن الرابط منسوخ من شريط العنوان بدل زر المشاركة، أو لأن المنشور خاص أو محذوف.',
      },
      {
        question: 'أين يذهب الفيديو بعد التحميل؟',
        answer: 'إلى تطبيق الملفات ثم إلى الصور بعد "حفظ الفيديو" من قائمة المشاركة.',
      },
      {
        question: 'هل أحتاج تطبيقاً ثالثاً؟',
        answer: 'لا. Safari وحده يكفي، بدون تثبيت أي شيء.',
      },
    ],
    relatedSlugs: ['تحميل-ريلز-انستقرام-للايفون-بدون-برامج', 'تحميل-فيديو-انستقرام-بدون-علامة-مائية-1080p'],
    enabled: true,
  },
  {
    id: 'gd-ar-highlights-cover',
    slug: 'حفظ-هايلايت-انستقرام-مع-الغلاف',
    lang: 'ar',
    keyword: 'حفظ هايلايت انستقرام مع الغلاف',
    tool: 'highlights',
    title: 'حفظ هايلايت انستقرام مع الغلاف بدقة عالية - بدون برامج',
    metaDescription:
      'احفظ هايلايت انستقرام كاملاً مع صورة الغلاف بدقتها الأصلية: الصق رابط الهايلايت أو اسم المستخدم، ثم نزّل الصور والفيديوهات دفعة واحدة.',
    h1: 'حفظ هايلايت انستقرام مع الغلاف',
    excerpt: 'نزّل محتوى الهايلايت كاملاً وليس الستوري المؤقت فقط.',
    sections: [
      {
        heading: 'الفرق بين الهايلايت والستوري',
        body: 'الستوري يختفي بعد 24 ساعة، أما الهايلايت فيبقى على الملف الشخصي. لذلك هو المصدر الأفضل لحفظ محتوى حساب عام بعد انتهاء الستوري.',
      },
      {
        heading: 'كيف تحفظ الهايلايت',
        body: 'افتح أداة الهايلايت، الصق رابط الهايلايت أو اكتب اسم المستخدم بدون @، ثم اختر الهايلايت المطلوب. ستظهر عناصره مرتبة مع زر تحميل لكل صورة وفيديو.',
      },
      {
        heading: 'غلاف الهايلايت',
        body: 'الغلاف صورة منفصلة عن محتوى الهايلايت. احفظها بصيغتها الأصلية JPG لاستخدامها في أرشيفك أو لإعادة نشر المحتوى بترتيبه الصحيح.',
      },
    ],
    faqs: [
      {
        question: 'هل يمكن حفظ هايلايت حساب خاص؟',
        answer: 'لا، الهايلايت يتبع خصوصية الحساب. الحسابات العامة فقط مدعومة.',
      },
      {
        question: 'هل يُحفظ الغلاف مع المحتوى؟',
        answer: 'الغلاف صورة مستقلة يمكن تنزيلها كملف JPG، إلى جانب صور وفيديوهات الهايلايت.',
      },
      {
        question: 'كم عدد العناصر التي يمكن تحميلها؟',
        answer: 'كل عناصر الهايلايت المعروضة. لا حد يومي على عدد التنزيلات.',
      },
    ],
    relatedSlugs: ['تحميل-ستوري-انستقرام-حساب-خاص', 'حفظ-ستوري-انستقرام-بدون-ما-يدري'],
    enabled: true,
  },
  {
    id: 'gd-ar-photo-carousel',
    slug: 'تحميل-صور-انستقرام-كاروسيل-دفعة-واحدة',
    lang: 'ar',
    keyword: 'تحميل صور انستقرام كاروسيل',
    tool: 'photo',
    title: 'تحميل صور انستقرام منشور كاروسيل كاملة بدقة أصلية',
    metaDescription:
      'كيف تنزّل كل صور منشور الكاروسيل في انستقرام مرة واحدة بدقتها الأصلية JPG: الصق الرابط واحفظ الشرائح كلها بدون برامج وبدون حساب.',
    h1: 'تحميل صور انستقرام كاروسيل دفعة واحدة',
    excerpt: 'لا تحفظ الشريحة الأولى فقط: الأداة تكتشف كل شرائح المنشور.',
    sections: [
      {
        heading: '1. انسخ رابط المنشور',
        body: 'افتح منشور الكاروسيل في انستقرام، اضغط المشاركة ثم "نسخ الرابط". الرابط الواحد يحتوي كل الشرائح، لا حاجة لنسخ كل صورة على حدة.',
      },
      {
        heading: '2. الصق الرابط في أداة الصور',
        body: 'اختر تبويب الصور، الصق الرابط، واضغط تحميل. تظهر كل الشرائح كبطاقات منفصلة مع زر تنزيل لكل واحدة بصيغة JPG.',
      },
      {
        heading: '3. احفظ على الجوال أو الكمبيوتر',
        body: 'على أندرويد تُحفظ الملفات في مجلد التنزيلات، وعلى الايفون في تطبيق الملفات. الدقة هي الدقة الأصلية التي رفعها صاحب المنشور، بلا إعادة ضغط.',
      },
    ],
    faqs: [
      {
        question: 'هل يمكن تحميل كل شرائح الكاروسيل مرة واحدة؟',
        answer: 'نعم، كل شريحة تظهر بزر تنزيل مستقل ويمكن حفظها كلها بالتتابع.',
      },
      {
        question: 'ما صيغة الصور وجودتها؟',
        answer: 'JPG بالدقة الأصلية المرفوعة، عادة 1080 بكسل وأكثر.',
      },
      {
        question: 'هل يعمل مع المنشورات القديمة؟',
        answer: 'نعم، ما دام المنشور عاماً ولم يُحذف.',
      },
    ],
    relatedSlugs: ['تحميل-فيديو-انستقرام-بدون-علامة-مائية-1080p', 'حفظ-هايلايت-انستقرام-مع-الغلاف'],
    enabled: true,
  },
  {
    id: 'gd-ar-no-watermark',
    slug: 'تحميل-فيديو-انستقرام-بدون-علامة-مائية-1080p',
    lang: 'ar',
    keyword: 'تحميل فيديو انستقرام بدون علامة مائية',
    tool: 'video',
    title: 'تحميل فيديو انستقرام بدون علامة مائية وبجودة 1080p الأصلية',
    metaDescription:
      'حمّل فيديوهات انستقرام بجودة 1080p الأصلية وبدون أي علامة مائية يضيفها الموقع: الصق الرابط واحفظ MP4 نظيفاً على جوالك أو الكمبيوتر.',
    h1: 'تحميل فيديو انستقرام بدون علامة مائية 1080p',
    excerpt: 'ما معنى "بدون علامة مائية" بدقة، وكيف تحصل على أنظف نسخة متاحة.',
    sections: [
      {
        heading: 'ما الذي نضيفه فعلاً؟',
        body: 'لا شيء. IGSaveGo لا يضع شعاره ولا أي نص على الفيديو. الملف الذي تحفظه هو المسار الذي تعرضه انستقرام نفسه بصيغة MP4.',
      },
      {
        heading: 'متى تبقى العلامة المائية؟',
        body: 'إذا كان صاحب الفيديو قد أضاف علامة مائية أو اسماً داخل المقطع، فهي جزء من الصورة وتبقى كما هي. لا يمكن لأي أداة إزالتها دون تشويه الفيديو.',
      },
      {
        heading: 'أفضل جودة متاحة',
        body: 'الأداة تعرض الدقة التي تكشفها انستقرام للمنشور، وغالباً 1080p للفيديو و720p للريلز القديمة. لا نرفع الدقة صناعياً ولا نعيد الترميز، حتى لا تفقد جودة الصورة.',
      },
    ],
    faqs: [
      {
        question: 'هل يضع IGSaveGo علامة مائية؟',
        answer: 'لا، لا يضيف الموقع أي شعار أو نص. الفيديو يُنزّل كما هو.',
      },
      {
        question: 'هل الجودة 1080p دائماً؟',
        answer: 'ليست دائماً: تعتمد على ما تقدمه انستقرام للمنشور. المنشورات الحديثة عادة 1080p، وبعض الريلز 720p.',
      },
      {
        question: 'هل يحتاج تسجيل دخول؟',
        answer: 'لا، ولا يطلب أي بيانات حساب.',
      },
    ],
    relatedSlugs: ['تعذر-تحميل-فيديو-انستقرام-على-الايفون', 'تحميل-صور-انستقرام-كاروسيل-دفعة-واحدة'],
    enabled: true,
  },
  {
    id: 'gd-ar-reels-android',
    slug: 'تحميل-ريلز-انستقرام-على-الاندرويد-بسرعة',
    lang: 'ar',
    keyword: 'تحميل ريلز انستقرام اندرويد',
    tool: 'reels',
    title: 'تحميل ريلز انستقرام على الاندرويد بسرعة وبدون تطبيق (2026)',
    metaDescription:
      'طريقة حفظ ريلز انستقرام على أندرويد من متصفح Chrome بدون تطبيقات: نسخ الرابط، لصق، تحميل MP4 بالصوت، ثم إيجاد الملف في الاستوديو.',
    h1: 'تحميل ريلز انستقرام على الاندرويد',
    excerpt: 'خطوات Chrome فقط، بدون تثبيت أي تطبيق من متجر Play.',
    sections: [
      {
        heading: '1. انسخ الرابط من التطبيق',
        body: 'اضغط المشاركة أسفل الريل واختر "نسخ الرابط". تأكد أن الحساب عام. يمكنك أيضاً مشاركة الرابط مباشرة من انستقرام إلى Chrome إن كان مثبتاً.',
      },
      {
        heading: '2. الصق في Chrome',
        body: 'افتح الموقع في Chrome، اختر تبويب الريلز، الصق الرابط في المربع واضغط تحميل. تظهر معاينة مع زر حفظ MP4 خلال ثوانٍ.',
      },
      {
        heading: '3. اعثر على الملف',
        body: 'افتح تطبيق الملفات ثم Downloads، أو استخدم مدير الملفات في جهازك. إن لم يظهر في الاستوديو، اختر "نقل إلى" وأرشفه في مجلد الصور.',
      },
    ],
    faqs: [
      {
        question: 'هل أحتاج تطبيق تحميل على أندرويد؟',
        answer: 'لا، Chrome والأداة يكفيان. لا حاجة لأي APK أو صلاحيات.',
      },
      {
        question: 'هل يُحمّل الريل مع الصوت؟',
        answer: 'نعم، المسار MP4 يحتوي الصوت الأصلي عندما تقدمه انستقرام.',
      },
      {
        question: 'أين أجد الريل بعد الحفظ؟',
        answer: 'في مجلد Downloads، ويمكن نقله إلى الاستوديو من مدير الملفات.'
      },
    ],
    relatedSlugs: ['تنزيل-صوت-الريلز-انستقرام-mp3', 'تحميل-ريلز-انستقرام-للايفون-بدون-برامج'],
    enabled: true,
  },
  {
    id: 'gd-en-story-private',
    slug: 'download-instagram-story-private-account',
    lang: 'en',
    keyword: 'download instagram story private account',
    tool: 'story',
    title: 'Instagram Story From a Private Account: What Actually Works (2026)',
    metaDescription:
      'Can you download a story from a private Instagram account? No — here is why, what the safe alternative is, and how to save public stories anonymously in HD.',
    h1: 'Download an Instagram Story From a Private Account',
    excerpt: 'The honest answer on private stories, plus the workflow that does work for public accounts.',
    sections: [
      {
        heading: 'Why private stories are inaccessible',
        body: 'Instagram only serves a private account’s story to approved followers who are signed in. A downloader that claims otherwise either asks for your password — a real account-takeover risk — or returns empty pages. IGSaveGo never asks for credentials, so it cannot see private media.',
      },
      {
        heading: 'What you can save',
        body: 'Any story posted by a public account within its 24-hour window. Type the username without @ into the Story tool and download each photo (JPG) or video (MP4) in its original quality.',
      },
      {
        heading: 'Staying anonymous',
        body: 'The fetch happens on our server, not through your session, so your name never appears in the owner’s viewer list and no notification is sent. That is the difference between saving a story and opening it in your app.',
      },
    ],
    faqs: [
      {
        question: 'Can I download a private story at all?',
        answer: 'No. Private media requires an authenticated follower session, and no legitimate tool can bypass that. Sites promising it are harvesting logins.',
      },
      {
        question: 'Does the owner know I saved a public story?',
        answer: 'No. Your account is never used to view it, so you do not appear on the viewer list.',
      },
      {
        question: 'What about stories older than 24 hours?',
        answer: 'They expire. Use the Highlights tool for anything the owner kept on their profile.',
      },
    ],
    relatedSlugs: ['save-instagram-story-anonymously', 'save-instagram-highlights-with-cover'],
    enabled: true,
  },
  {
    id: 'gd-en-reels-mp3',
    slug: 'instagram-reels-to-mp3-audio-download',
    lang: 'en',
    keyword: 'instagram reels to mp3',
    tool: 'reels',
    title: 'Instagram Reels to MP3: Extract the Audio Only (High Quality)',
    metaDescription:
      'Convert an Instagram Reel to MP3 and download just the audio: paste the Reel link, pick the audio option, and save the track in seconds — no app, no watermark.',
    h1: 'Download Instagram Reels Audio as MP3',
    excerpt: 'Save the sound without keeping the video file.',
    sections: [
      {
        heading: '1. Copy the Reel link',
        body: 'In the Instagram app tap Share under the Reel, then Copy Link. The account must be public; private Reels are out of reach by design.',
      },
      {
        heading: '2. Extract the audio',
        body: 'Paste the link into the Reels tool and choose the MP3 option on the result card. The conversion runs in your browser against the original audio stream, so no re-encoding noise is added.',
      },
      {
        heading: '3. Save the file',
        body: 'Press download and the MP3 lands in your Downloads folder. Audio quality is capped by the Reel’s own stream — we never fake a higher bitrate.',
      },
    ],
    faqs: [
      {
        question: 'Can I get the audio without the video?',
        answer: 'Yes. The Reels tool converts the audio track to MP3 and lets you save it alone.',
      },
      {
        question: 'Why do some Reels have no audio option?',
        answer: 'A few Reels are published with a video-only stream. If Instagram exposes no audio track, there is nothing to convert.',
      },
      {
        question: 'Is it free?',
        answer: 'Yes, with no account and no daily quota beyond fair-use rate limits.',
      },
    ],
    relatedSlugs: ['download-instagram-reels-on-iphone-without-app', 'instagram-video-downloader-no-watermark-1080p'],
    enabled: true,
  },
  {
    id: 'gd-en-iphone-troubleshoot',
    slug: 'instagram-video-download-not-working-iphone',
    lang: 'en',
    keyword: 'instagram video download not working iphone',
    tool: 'video',
    title: 'Instagram Video Download Not Working on iPhone? 5 Fixes',
    metaDescription:
      'Download button not working in Safari? These are the five real causes — wrong link, private post, blockers, storage, iOS save flow — and the fix for each.',
    h1: 'Instagram Video Download Not Working on iPhone',
    excerpt: 'Fix the download in Safari without installing anything.',
    sections: [
      {
        heading: '1. The link is not a post link',
        body: 'Copying from Safari’s address bar or sharing a story gives a URL the extractor cannot resolve. Open the post, tap Share, then Copy Link, and paste that.',
      },
      {
        heading: '2. The post is private or deleted',
        body: 'Private posts are never downloadable. If the link opens to a login wall in a normal browser tab, the media is not public. Deleted posts fail the same way.',
      },
      {
        heading: '3. Safari saves to Files, not Photos',
        body: 'Downloads go to the Files app first. Open the file, tap Share, then Save Video to reach Photos. If nothing happens at all, disable content blockers for this site and retry on another network.',
      },
    ],
    faqs: [
      {
        question: 'Why does the button do nothing on iPhone?',
        answer: 'Usually a content blocker or an in-app browser (Instagram, Facebook) limiting downloads. Open the page in Safari directly.',
      },
      {
        question: 'Where is the file saved?',
        answer: 'In Files → Downloads, then Photos after using Save Video from the share sheet.',
      },
      {
        question: 'Do I need an app?',
        answer: 'No. Safari is enough.',
      },
    ],
    relatedSlugs: ['download-instagram-reels-on-iphone-without-app', 'instagram-video-downloader-no-watermark-1080p'],
    enabled: true,
  },
  {
    id: 'gd-en-highlights-cover',
    slug: 'save-instagram-highlights-with-cover',
    lang: 'en',
    keyword: 'save instagram highlights with cover',
    tool: 'highlights',
    title: 'Save Instagram Highlights With Their Cover in Full Quality',
    metaDescription:
      'Download a full Instagram Highlight — every photo and video plus the cover image — in original quality, from the browser, without an app or an account.',
    h1: 'Save Instagram Highlights With the Cover',
    excerpt: 'Highlights outlive the 24-hour story, so they are the archive worth saving.',
    sections: [
      {
        heading: 'Highlights vs stories',
        body: 'Stories disappear after 24 hours; highlights stay pinned on the profile. That makes them the reliable source for saving a public account’s best content later.',
      },
      {
        heading: 'How to download one',
        body: 'Open the Highlights tool, paste the highlight URL or type the username without @, and pick the highlight. Its items are listed with a download button for each photo and video.',
      },
      {
        heading: 'The cover image',
        body: 'A highlight cover is a separate JPG. Save it alongside the items so a rebuilt archive keeps the same order and look on your device.',
      },
    ],
    faqs: [
      {
        question: 'Can I save highlights from private accounts?',
        answer: 'No. Highlights inherit the account’s privacy; only public profiles work.',
      },
      {
        question: 'Is the cover included?',
        answer: 'Yes, it downloads as its own JPG next to the highlight items.',
      },
      {
        question: 'Is there a limit?',
        answer: 'No daily cap; fair-use rate limits keep the service up for everyone.',
      },
    ],
    relatedSlugs: ['download-instagram-story-private-account', 'save-instagram-story-anonymously'],
    enabled: true,
  },
  {
    id: 'gd-en-carousel',
    slug: 'download-instagram-carousel-photos',
    lang: 'en',
    keyword: 'download instagram carousel photos',
    tool: 'photo',
    title: 'Download Every Photo in an Instagram Carousel (Original Quality)',
    metaDescription:
      'Save all slides of an Instagram carousel post at once in original JPG quality: one link, every image detected, no app and no login required.',
    h1: 'Download All Photos in an Instagram Carousel',
    excerpt: 'One link is enough — the tool finds every slide, not just the first.',
    sections: [
      {
        heading: '1. Copy one link',
        body: 'Open the carousel post, tap Share, then Copy Link. The single post URL contains every slide; there is no need to copy images one by one.',
      },
      {
        heading: '2. Paste into the Photo tool',
        body: 'Choose the Photo tab, paste the link and download. Each slide appears as a card with its own JPG download button.',
      },
      {
        heading: '3. Save them all',
        body: 'On Android files go to Downloads; on iOS to the Files app. Quality is the resolution the author uploaded — typically 1080px wide — with no recompression.',
      },
    ],
    faqs: [
      {
        question: 'Does it download every slide?',
        answer: 'Yes. Carousels are detected and each slide gets its own download button.',
      },
      {
        question: 'What format and quality?',
        answer: 'JPG at the original uploaded resolution, usually 1080px and above.',
      },
      {
        question: 'Does it work for old posts?',
        answer: 'Yes, as long as the post is still public.',
      },
    ],
    relatedSlugs: ['download-instagram-photos-to-android-gallery', 'instagram-video-downloader-no-watermark-1080p'],
    enabled: true,
  },
  {
    id: 'gd-en-no-watermark',
    slug: 'instagram-video-downloader-no-watermark-1080p',
    lang: 'en',
    keyword: 'instagram video downloader no watermark 1080p',
    tool: 'video',
    title: 'Instagram Video Downloader: 1080p MP4 With No Added Watermark',
    metaDescription:
      'Download Instagram videos in the 1080p MP4 stream Instagram serves, with no logo or watermark added by the site. Free, no login, works on phone and desktop.',
    h1: 'Instagram Video Download in 1080p Without a Watermark',
    excerpt: 'What “no watermark” really means, and how to get the cleanest copy available.',
    sections: [
      {
        heading: 'What we add: nothing',
        body: 'IGSaveGo does not burn a logo, URL or text into your file. You save the MP4 stream Instagram exposes for that post, byte for byte.',
      },
      {
        heading: 'When a watermark remains',
        body: 'If the creator baked a watermark or handle into the video, it is part of the picture and stays. No tool can remove it without visibly damaging the footage.',
      },
      {
        heading: 'The best quality available',
        body: 'The result card shows the resolution Instagram actually exposes — usually 1080p for video posts, sometimes 720p for older Reels. Nothing is upscaled or re-encoded, so no quality is invented or lost.',
      },
    ],
    faqs: [
      {
        question: 'Do you add a watermark?',
        answer: 'No. No logo or text is added; the file downloads as served by Instagram.',
      },
      {
        question: 'Is it always 1080p?',
        answer: 'No. It is the highest resolution Instagram exposes for that post, which is commonly 1080p.',
      },
      {
        question: 'Do I need an account?',
        answer: 'No login is required at any step.',
      },
    ],
    relatedSlugs: ['instagram-video-download-not-working-iphone', 'download-instagram-video-on-pc-windows'],
    enabled: true,
  },
  {
    id: 'gd-en-pc-windows',
    slug: 'download-instagram-video-on-pc-windows',
    lang: 'en',
    keyword: 'download instagram video on pc',
    tool: 'video',
    title: 'Download Instagram Videos on PC or Windows (No Software)',
    metaDescription:
      'Save Instagram videos and Reels to your Windows PC or Mac from the browser: copy the post link, paste it, download the MP4, and find it in Downloads.',
    h1: 'Download Instagram Videos on PC or Windows',
    excerpt: 'No desktop app, no extension — just a browser tab.',
    sections: [
      {
        heading: '1. Get the post link on desktop',
        body: 'Open the post on instagram.com, click the three dots above the media, and choose Copy link. On mobile, Share → Copy Link works the same.',
      },
      {
        heading: '2. Download in your browser',
        body: 'Paste the link into the downloader and press Download. Chrome, Edge and Firefox all save the MP4 to your Downloads folder; there is no installer and no extension to trust.',
      },
      {
        heading: '3. Keep the quality',
        body: 'The file keeps the resolution Instagram served, usually 1080p. If Windows asks where to save, pick a folder you can find again rather than letting it disappear into a temp path.',
      },
    ],
    faqs: [
      {
        question: 'Do I need software on Windows?',
        answer: 'No. Any current browser handles the download; nothing is installed.',
      },
      {
        question: 'Where does the MP4 go?',
        answer: 'Your Downloads folder, unless you choose another location in the save dialog.',
      },
      {
        question: 'Does it work on Mac too?',
        answer: 'Yes — Safari and Chrome on macOS behave the same way.',
      },
    ],
    relatedSlugs: ['instagram-video-downloader-no-watermark-1080p', 'instagram-video-download-not-working-iphone'],
    enabled: true,
  },
];

// ---------- cache (localStorage) + Supabase sync, mirrors keywordPages.ts ----------
export function loadGuides(): GuideArticle[] {
  try {
    if (typeof window === 'undefined') return DEFAULT_GUIDES;
    const stored = localStorage.getItem(GUIDES_STORAGE_KEY);
    if (!stored) return DEFAULT_GUIDES;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_GUIDES;
    const byId = new Map<string, GuideArticle>();
    DEFAULT_GUIDES.forEach((g) => byId.set(g.id, g));
    parsed.forEach((g: GuideArticle) => {
      if (g && typeof g.id === 'string') byId.set(g.id, { ...byId.get(g.id), ...g } as GuideArticle);
    });
    return Array.from(byId.values());
  } catch {
    return DEFAULT_GUIDES;
  }
}

export function saveGuides(guides: GuideArticle[]): void {
  try {
    localStorage.setItem(GUIDES_STORAGE_KEY, JSON.stringify(guides));
  } catch {}
}

function getApiBase(): string {
  try {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
  } catch {}
  return '';
}

function getAdminToken(): string {
  try {
    return localStorage.getItem('sss_admin_token') || '';
  } catch {
    return '';
  }
}

export async function refreshGuides(): Promise<GuideArticle[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.guides) || data.guides.length === 0) return null;
    saveGuides(data.guides);
    return data.guides as GuideArticle[];
  } catch {
    return null;
  }
}

export async function apiFetchAllGuides(): Promise<GuideArticle[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides?all=1`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${getAdminToken()}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.guides)) return null;
    return data.guides as GuideArticle[];
  } catch {
    return null;
  }
}

export async function apiUpsertGuide(guide: GuideArticle): Promise<'ok' | 'no-db' | 'error'> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(guide),
    });
    if (res.ok) return 'ok';
    const data = await res.json().catch(() => null);
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'error';
  } catch {
    return 'error';
  }
}

export async function apiDeleteGuide(id: string): Promise<'ok' | 'no-db' | 'error'> {
  try {
    const res = await fetch(`${getApiBase()}/api/guides?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${getAdminToken()}` },
    });
    if (res.ok) return 'ok';
    const data = await res.json().catch(() => null);
    if (res.status === 503 || data?.supabase === false) return 'no-db';
    return 'error';
  } catch {
    return 'error';
  }
}

export function findGuide(slug: string, guides?: GuideArticle[]): GuideArticle | null {
  const list = guides || loadGuides();
  let s = (slug || '').trim();
  try {
    s = decodeURIComponent(s);
  } catch {}
  s = s.toLowerCase();
  const found = list.find((g) => g.enabled && g.slug.toLowerCase() === s);
  return found || null;
}

export function guidesByLang(lang: LanguageCode, guides?: GuideArticle[]): GuideArticle[] {
  const list = guides || loadGuides();
  const filtered = list.filter((g) => g.enabled && g.lang === lang);
  return filtered.length > 0 ? filtered : list.filter((g) => g.enabled);
}

export function sanitizeGuideSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function emptyGuide(lang: LanguageCode = 'en'): GuideArticle {
  return {
    id: `gd_custom_${Date.now()}`,
    slug: '',
    lang,
    tool: 'video' as MediaType,
    keyword: '',
    title: '',
    metaDescription: '',
    h1: '',
    excerpt: '',
    sections: [{ heading: '', body: '' }],
    faqs: [{ question: '', answer: '' }],
    relatedSlugs: [],
    enabled: true,
  };
}
