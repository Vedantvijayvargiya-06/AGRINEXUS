export const POST_HARVEST_KNOWLEDGE_BASE = [
  {
    topic: 'Tomato Storage & Ripening',
    keywords: ['tomato', 'ripening', 'cold storage', 'chilling injury', 'टमाटर'],
    content_en:
      'Tomatoes should not be stored below 10°C as chilling injury causes loss of flavor and softening. Optimal holding temperature is 12°C-15°C with 85-90% relative humidity.',
    content_hi:
      'टमाटर को 10°C से नीचे स्टोर नहीं करना चाहिए क्योंकि इससे चिलिंग इंजरी (स्वाद खराब और सड़न) हो सकती है। इष्टतम तापमान 12°C-15°C और 85-90% आर्द्रता है।'
  },
  {
    topic: 'Onion Curing & Ventilation',
    keywords: ['onion', 'sprouting', 'curing', 'ventilation', 'storage', 'प्याज'],
    content_en:
      'Onions require thorough field curing (drying the neck) for 5-7 days before storage. Store in well-ventilated sheds at 25-30°C with low humidity (<65%) to prevent black mold and premature sprouting.',
    content_hi:
      'प्याज को भंडारण से पहले 5-7 दिनों तक अच्छी तरह सुखाना (क्योरिंग) आवश्यक है। इसे हवादार गोदाम में 25-30°C पर कम नमी (<65%) में रखें ताकि फफूंद और अंकुरण न हो।'
  },
  {
    topic: 'Cluster Pooling Transport',
    keywords: ['cluster', 'pooling', 'truck', 'transport', 'freight', 'share', 'पूलिंग', 'किराया', 'गाड़ी'],
    content_en:
      'Cluster pooling combines harvests from neighboring farmers in a 15km radius into a single large refrigerated truck, reducing per-kg transport freight by up to 60%.',
    content_hi:
      'क्लस्टर पूलिंग 15 किमी के दायरे में आसपास के किसानों की उपज को एक साथ बड़े वाहन में भेजती है, जिससे प्रति किलो परिवहन भाड़ा 60% तक कम हो जाता है।'
  },
  {
    topic: 'Post-Harvest Processing Opportunities',
    keywords: ['process', 'processing', 'puree', 'pulp', 'dehydration', 'chips', 'प्रसंस्करण'],
    content_en:
      'When fresh market prices fall below production costs, diverting produce to processing (puree for tomato, dehydration for onion, chips for potato) locks in a guaranteed minimum floor price.',
    content_hi:
      'जब ताजी मंडी में भाव गिरते हैं, तो उपज को प्रसंस्करण (टमाटर प्यूरी, प्याज निर्जलीकरण, आलू चिप्स) में भेजने से न्यूनतम सुरक्षित आय प्राप्त होती है।'
  }
];

function fmtInr(num) {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export class AgriNexusAssist {
  static answerQuery({
    query,
    userLang = 'en',
    batchContext = null,
    marketContext = null,
    fpoName = 'Kisan Kalyan FPO'
  }) {
    const qLower = (query || '').toLowerCase().trim();
    const hindiTriggers = ['क्या', 'कैसे', 'टमाटर', 'प्याज', 'बेचें', 'रखें', 'भाव', 'मंडी', 'कितना'];
    const isHindi =
      userLang.startsWith('hi') || hindiTriggers.some((char) => (query || '').includes(char));

    const outOfScopeTriggers = [
      'cricket',
      'ipl',
      'election',
      'movie',
      'cinema',
      'illness',
      'doctor',
      'medicine',
      'crypto',
      'bitcoin'
    ];
    if (outOfScopeTriggers.some((w) => qLower.includes(w))) {
      if (isHindi) {
        return {
          answer:
            'मुझे केवल कृषि उपज, मंडी भाव, भंडारण, क्लस्टर पूलिंग और फसल गुणवत्ता के प्रश्नों का उत्तर देने के लिए प्रशिक्षित किया गया है। अन्य सहायता के लिए कृपया एफपीओ हेल्पडेस्क से संपर्क करें।',
          language: 'hi',
          grounded: false,
          uncertain: true,
          escalate_to_helpdesk: true,
          source: 'guardrail'
        };
      }
      return {
        answer:
          'I am specialized solely in post-harvest decisions, market intelligence, crop shelf-life, and cluster pooling. For this topic, please contact the FPO Helpdesk.',
        language: 'en',
        grounded: false,
        uncertain: true,
        escalate_to_helpdesk: true,
        source: 'guardrail'
      };
    }

    if (batchContext) {
      const crop = batchContext.crop || 'Produce';
      const cropHi = batchContext.crop_name_hi || crop;
      const quality = batchContext.current_quality ?? 90.0;
      const shelfHrs = batchContext.remaining_shelf_life_hrs ?? 72.0;
      const shelfDays = batchContext.remaining_shelf_life_days ?? 3.0;
      const risk = batchContext.spoilage_risk ?? 10.0;
      const rec = batchContext.recommendation || {};
      const bestVal = rec.best_expected_value ?? 0.0;

      const recKeywords = [
        'recommend',
        'action',
        'why',
        'decision',
        'what to do',
        'store',
        'sell',
        'process',
        'redirect',
        'सलाह',
        'सुझाव',
        'क्यों',
        'क्या करूं',
        'बेचूं',
        'रखूं'
      ];
      if (recKeywords.some((w) => qLower.includes(w))) {
        const ans = isHindi
          ? `आपके ${cropHi} बैच (गुणवत्ता ${Math.round(quality)}%, शेष जीवन ${shelfDays} दिन) के लिए हमारी प्रणाली **${rec.recommended_title_hi || 'उत्तम विकल्प'}** की सलाह देती है। इससे आपको लगभग **₹${fmtInr(bestVal)}** की अधिकतम शुद्ध आय होगी। ${rec.explanation_hi || ''}`
          : `For your ${crop} batch (Quality: ${Math.round(quality)}%, Remaining Shelf-Life: ${shelfHrs.toFixed(1)} hrs / ${shelfDays} days), the optimal decision is **${rec.recommended_title || 'Sell Now'}**. Projected net realization is **₹${fmtInr(bestVal)}**. ${rec.explanation_en || ''}`;

        return {
          answer: ans,
          language: isHindi ? 'hi' : 'en',
          grounded: true,
          uncertain: false,
          escalate_to_helpdesk: false,
          source: 'batch_digital_twin_and_decision_engine'
        };
      }

      const shelfKeywords = [
        'shelf',
        'life',
        'spoil',
        'decay',
        'quality',
        'expiry',
        'खराब',
        'सड़न',
        'गुणवत्ता',
        'कितने दिन',
        'सेल्फ',
        'लाइफ',
        'जीवन',
        'कितनी'
      ];
      if (shelfKeywords.some((w) => qLower.includes(w))) {
        const ans = isHindi
          ? `आपके ${cropHi} बैच का डिजिटल ट्विन विश्लेषण दर्शाता है कि वर्तमान गुणवत्ता **${Math.round(quality)}%** और खराब होने का जोखिम **${Math.round(risk)}%** है। वर्तमान तापमान पर यह फसल अगले **${shelfDays} दिन (${shelfHrs} घंटे)** तक सुरक्षित रूप से रखी जा सकती है।`
          : `Your ${crop} batch has a computed quality score of **${Math.round(quality)}%** with a spoilage risk of **${Math.round(risk)}%**. At current ambient storage temperature, remaining safe shelf-life is approximately **${shelfDays} days (${shelfHrs} hours)**.`;

        return {
          answer: ans,
          language: isHindi ? 'hi' : 'en',
          grounded: true,
          uncertain: false,
          escalate_to_helpdesk: false,
          source: 'digital_twin_decay_engine'
        };
      }
    }

    const marketKeywords = ['price', 'mandi', 'rate', 'rate kya', 'bhav', 'market', 'भाव', 'रेट', 'मंडी'];
    if (marketKeywords.some((w) => qLower.includes(w)) && marketContext && marketContext.length > 0) {
      const topItems = marketContext.slice(0, 3);
      const ans = isHindi
        ? 'ताजा मंडी भाव (Agmarknet / eNAM लाइव):\n' +
          topItems
            .map((m) => `• ${m.crop} (${m.mandi}): ₹${m.modal_price_per_kg}/किलो (रुझान: ${m.trend})`)
            .join('\n') +
          '\n\nआप किसी विशेष फसल या दूरी के अनुसार भी पूछ सकते हैं।'
        : 'Latest Mandi Prices (Agmarknet / eNAM Synced):\n' +
          topItems
            .map(
              (m) =>
                `• ${m.crop} at ${m.mandi}: ₹${m.modal_price_per_kg}/kg (Trend: ${m.trend}, Arrivals: ${m.arrivals_tonnes ?? 100}T)`
            )
            .join('\n');

      return {
        answer: ans,
        language: isHindi ? 'hi' : 'en',
        grounded: true,
        uncertain: false,
        escalate_to_helpdesk: false,
        source: 'agmarknet_market_feed'
      };
    }

    for (const doc of POST_HARVEST_KNOWLEDGE_BASE) {
      if (doc.keywords.some((k) => qLower.includes(k))) {
        return {
          answer: isHindi ? doc.content_hi : doc.content_en,
          language: isHindi ? 'hi' : 'en',
          grounded: true,
          uncertain: false,
          escalate_to_helpdesk: false,
          source: `icar_kb_${doc.topic}`
        };
      }
    }

    if (isHindi) {
      return {
        answer: `मुझे इस विशिष्ट प्रश्न का निश्चित उत्तर देने के लिए पर्याप्त लाइव डेटा नहीं मिला। गलत अनुमान लगाने के बजाय, मैं आपको ${fpoName} हेल्पडेस्क से जुड़ने की सलाह देता हूँ।`,
        language: 'hi',
        grounded: false,
        uncertain: true,
        escalate_to_helpdesk: true,
        source: 'fallback_confidence_guardrail'
      };
    }

    return {
      answer: `I don't have high enough confidence or specific live telemetry to answer this question accurately. Rather than guessing, I recommend escalating this to your ${fpoName} expert desk.`,
      language: 'en',
      grounded: false,
      uncertain: true,
      escalate_to_helpdesk: true,
      source: 'fallback_confidence_guardrail'
    };
  }
}
