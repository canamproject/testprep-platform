import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';

// ─── EXAM DEFINITIONS ────────────────────────────────────────
const EXAMS = {
  IELTS: {
    label: 'IELTS Academic / General',
    scoreLabel: 'Band Score',
    scoreMin: 0, scoreMax: 9, scoreStep: 0.5,
    defaultTarget: 7.0,
    modules: ['Listening','Reading','Writing','Speaking','Grammar','Vocabulary'],
    color: '#3b82f6',
    icon: '🇬🇧',
    scoreInfo: '9.0 = Expert · 8.0 = Very Good · 7.0 = Good · 6.0 = Competent',
    toDisplay: (pct) => {
      if (pct >= 90) return '9.0'; if (pct >= 83) return '8.5'; if (pct >= 76) return '8.0';
      if (pct >= 69) return '7.5'; if (pct >= 62) return '7.0'; if (pct >= 55) return '6.5';
      if (pct >= 48) return '6.0'; if (pct >= 41) return '5.5'; if (pct >= 34) return '5.0';
      return '4.5';
    },
    targetToPct: (band) => Math.min(100, Math.round((parseFloat(band) / 9) * 100 * 1.05)),
  },
  PTE: {
    label: 'PTE Academic',
    scoreLabel: 'PTE Score',
    scoreMin: 10, scoreMax: 90, scoreStep: 1,
    defaultTarget: 65,
    modules: ['Speaking & Writing','Reading','Listening','Grammar','Full Mock'],
    color: '#8b5cf6',
    icon: '🎓',
    scoreInfo: '79-90 = C1 Advanced · 59-78 = B2 Upper · 43-58 = B1 Intermediate',
    toDisplay: (pct) => String(Math.round(10 + (pct / 100) * 80)),
    targetToPct: (score) => Math.round(((parseFloat(score) - 10) / 80) * 100),
  },
  GERMAN_A1: {
    label: 'German A1 (Starter)', scoreLabel: 'Score %',
    scoreMin: 0, scoreMax: 100, scoreStep: 1, defaultTarget: 70,
    modules: ['Grammatik','Wortschatz','Lesen','Hören','Schreiben','Full Mock'],
    color: '#f59e0b', icon: '🇩🇪',
    scoreInfo: '70%+ = Pass (A1) · 90%+ = Distinction',
    toDisplay: (pct) => `${Math.round(pct)}%`,
    targetToPct: (s) => parseFloat(s),
  },
  GERMAN_A2: {
    label: 'German A2 (Elementary)', scoreLabel: 'Score %',
    scoreMin: 0, scoreMax: 100, scoreStep: 1, defaultTarget: 72,
    modules: ['Grammatik','Wortschatz','Lesen','Hören','Schreiben','Full Mock'],
    color: '#f59e0b', icon: '🇩🇪',
    scoreInfo: '72%+ = Pass (A2) · 90%+ = Distinction',
    toDisplay: (pct) => `${Math.round(pct)}%`,
    targetToPct: (s) => parseFloat(s),
  },
  GERMAN_B1: {
    label: 'German B1 (Intermediate)', scoreLabel: 'Score %',
    scoreMin: 0, scoreMax: 100, scoreStep: 1, defaultTarget: 65,
    modules: ['Grammatik','Wortschatz','Lesen','Hören','Schreiben','Full Mock'],
    color: '#ef4444', icon: '🇩🇪',
    scoreInfo: '65%+ = Pass (B1) · 85%+ = Distinction',
    toDisplay: (pct) => `${Math.round(pct)}%`,
    targetToPct: (s) => parseFloat(s),
  },
  GERMAN_B2: {
    label: 'German B2 (Upper Intermediate)', scoreLabel: 'Score %',
    scoreMin: 0, scoreMax: 100, scoreStep: 1, defaultTarget: 70,
    modules: ['Grammatik','Wortschatz','Lesen','Hören','Schreiben','Full Mock'],
    color: '#ef4444', icon: '🇩🇪',
    scoreInfo: '70%+ = Pass (B2) · 90%+ = Distinction',
    toDisplay: (pct) => `${Math.round(pct)}%`,
    targetToPct: (s) => parseFloat(s),
  },
  FRENCH_A1: {
    label: 'French A1 (DELF A1)', scoreLabel: 'Score %',
    scoreMin: 0, scoreMax: 100, scoreStep: 1, defaultTarget: 50,
    modules: ['Compréhension','Expression','Grammaire','Vocabulaire','Full Mock'],
    color: '#ec4899', icon: '🇫🇷',
    scoreInfo: '50%+ = Pass (A1) · Each section minimum 5/25',
    toDisplay: (pct) => `${Math.round(pct)}%`,
    targetToPct: (s) => parseFloat(s),
  },
};

// ─── QUESTION BANK ────────────────────────────────────────────
const QB = {
  IELTS_Grammar: [
    { q: 'She _____ to the gym every day before she started working night shifts.', opts: ['goes','used to go','is going','had going'], a: 1, exp: '"Used to go" describes a past habit that no longer continues.' },
    { q: 'By the time we arrived, the concert _____ for two hours.', opts: ['was playing','has been playing','had been playing','played'], a: 2, exp: 'Past perfect continuous for an action ongoing before a past moment.' },
    { q: 'The report _____ by the committee before the meeting begins.', opts: ['will complete','will be completing','will have been completed','is completing'], a: 2, exp: 'Future perfect passive: the action completes before a future reference point.' },
    { q: 'Neither the students nor the teacher _____ aware of the schedule change.', opts: ['were','was','are','is'], a: 1, exp: 'With "neither...nor", the verb agrees with the nearest subject (teacher = singular).' },
    { q: '_____ she studies harder, she will not pass the examination.', opts: ['Unless','If','Although','Whereas'], a: 0, exp: '"Unless" = "if not" — introduces a negative condition.' },
    { q: 'The data _____ collected from three separate research centres.', opts: ['was','were','has','have'], a: 1, exp: '"Data" is the plural of "datum" — it takes a plural verb in formal writing.' },
    { q: 'He suggested _____ the project deadline by one week.', opts: ['to extend','extending','extend','that extending'], a: 1, exp: '"Suggest" is followed by a gerund (verb + ing), not an infinitive.' },
    { q: 'It is essential that every participant _____ the safety guidelines.', opts: ['follows','follow','following','followed'], a: 1, exp: 'Subjunctive mood after "essential that": base form without -s.' },
    { q: 'The scientist discovered a phenomenon _____ had never been observed before.', opts: ['which','who','whom','where'], a: 0, exp: '"Which" refers to a thing (phenomenon). "Who/whom" is for people.' },
    { q: 'Barely _____ sat down when the alarm went off.', opts: ['she had','had she','she has','has she'], a: 1, exp: 'Inversion required after negative adverbs like "barely" at sentence start.' },
  ],
  IELTS_Vocabulary: [
    { q: 'The word "ameliorate" most closely means:', opts: ['worsen','improve','evaluate','neglect'], a: 1, exp: 'Ameliorate = to make something bad or unsatisfactory better.' },
    { q: 'A "ubiquitous" phenomenon is one that is:', opts: ['rare and special','found everywhere','difficult to understand','recently discovered'], a: 1, exp: 'Ubiquitous = present, appearing, or found everywhere.' },
    { q: 'Which word means "to make something less severe or painful"?', opts: ['exacerbate','alleviate','deteriorate','aggravate'], a: 1, exp: 'Alleviate = make (suffering, deficiency, or a problem) less severe.' },
    { q: '"Pragmatic" decisions are based on:', opts: ['emotions and feelings','idealistic principles','practical considerations','theoretical models'], a: 2, exp: 'Pragmatic = dealing with things sensibly and realistically.' },
    { q: 'The opposite of "transparent" in academic writing context:', opts: ['opaque','clear','evident','visible'], a: 0, exp: 'Opaque = not able to be seen through; not transparent or clear in meaning.' },
    { q: 'A researcher who "corroborates" a finding:', opts: ['disputes it','confirms it with new evidence','ignores it','simplifies it'], a: 1, exp: 'Corroborate = confirm or give support to a statement or finding.' },
    { q: '"Proliferation" refers to:', opts: ['rapid decrease','steady improvement','rapid increase in number','careful organisation'], a: 2, exp: 'Proliferation = rapid reproduction or growth; rapid increase in number.' },
    { q: 'The word "mitigate" means to:', opts: ['intensify a problem','make less severe or serious','completely solve an issue','cause a new problem'], a: 1, exp: 'Mitigate = lessen the gravity, seriousness, or painfulness of something.' },
    { q: 'Which word best fits: "The study produced _____ results that could not be replicated."', opts: ['definitive','anomalous','coherent','consistent'], a: 1, exp: 'Anomalous = deviating from what is standard, normal, or expected.' },
    { q: '"Stringent" regulations are:', opts: ['flexible and easy','strict and demanding','temporary and informal','recent and untested'], a: 1, exp: 'Stringent = (of regulations, requirements, or conditions) strict, precise, and exacting.' },
  ],
  IELTS_Reading: [
    { passage: 'The term "smart city" refers to an urban area that uses different types of electronic Internet of Things (IoT) sensors to collect data and then uses insights gained from that data to manage assets, resources and services efficiently. This data is collected from citizens, devices, buildings and assets that is then processed and analysed to monitor and manage traffic, transportation systems, power plants, utilities, water supply networks, waste management, crime detection, information systems, schools, libraries, hospitals, and other community services.', q: 'According to the passage, what is the PRIMARY purpose of data collection in a smart city?', opts: ['To increase the city\'s revenue','To manage assets, resources and services efficiently','To monitor citizens\' behaviour','To replace human workers'], a: 1, exp: 'The passage states data is used "to manage assets, resources and services efficiently".' },
    { q: 'Which of the following is NOT listed as something managed by smart city data?', opts: ['Waste management','School services','Agricultural production','Hospitals'], a: 2, exp: 'Agricultural production is not mentioned in the passage\'s list of managed systems.' },
    { q: 'The word "insights" in the passage is closest in meaning to:', opts: ['raw statistics','deep understanding','physical equipment','financial reports'], a: 1, exp: 'Insights = an accurate and deep understanding gained from data analysis.' },
    { q: 'The passage implies that smart city technology:', opts: ['is only used in developing nations','requires only one type of sensor','integrates multiple urban systems','has no impact on citizens'], a: 2, exp: 'The passage describes management of many different urban systems — implying integration.' },
    { q: 'According to the passage, what do IoT sensors primarily do?', opts: ['Generate electricity','Collect data','Replace infrastructure','Train citizens'], a: 1, exp: 'The passage explicitly states IoT sensors are used "to collect data".' },
    { q: 'The passage is primarily concerned with:', opts: ['criticising IoT technology','defining and explaining smart cities','comparing cities worldwide','discussing privacy concerns'], a: 1, exp: 'The passage defines "smart city" and explains how IoT data collection works in it.' },
    { q: 'From the context, "assets" most likely refers to:', opts: ['financial investments only','valuable resources and infrastructure','individual citizens','emergency services'], a: 1, exp: 'In urban context, assets = things of value owned or managed by the city.' },
    { q: 'The phrase "processed and analysed" suggests the data goes through:', opts: ['a single quick step','multiple stages of examination','immediate public reporting','direct government oversight'], a: 1, exp: '"Processed AND analysed" implies two stages of treatment before use.' },
    { q: 'Which of these best describes the tone of the passage?', opts: ['Critical and sceptical','Neutral and informative','Enthusiastic and persuasive','Personal and emotional'], a: 1, exp: 'The passage is descriptive and objective — typical of an informational text.' },
    { q: 'Community services mentioned include all EXCEPT:', opts: ['Schools and libraries','Power plants','Military installations','Hospitals'], a: 2, exp: 'Military installations are not mentioned among the listed community services.' },
  ],
  IELTS_Listening: [
    { q: 'In a university lecture, a professor says "The evidence, while compelling, remains inconclusive." This means:', opts: ['The evidence is weak and should be ignored','The evidence is convincing but not yet proven','The evidence is fully accepted by all researchers','The evidence contradicts previous findings'], a: 1, exp: 'Compelling = convincing; inconclusive = not leading to a definite conclusion.' },
    { q: 'A student asks about "prerequisites" for a course. This means she wants to know:', opts: ['The final exam date','Requirements that must be met before enrolling','The course fee','The reading list'], a: 1, exp: 'Prerequisites = things required as a prior condition.' },
    { q: 'An announcer says "The venue has a capacity of five hundred." What information is given?', opts: ['The cost of tickets','The location of the event','The maximum number of people allowed','The duration of the event'], a: 2, exp: 'Capacity = the maximum amount that something can contain.' },
    { q: 'A tour guide says "The museum houses artefacts dating back to the Bronze Age." What does this tell us?', opts: ['The museum is built from bronze','The museum contains very old historical objects','The museum only shows art from one period','The museum was founded during the Bronze Age'], a: 1, exp: '"Houses artefacts" = contains historical objects; Bronze Age = 3000-1200 BCE.' },
    { q: 'In a conversation, someone says "I\'m afraid we\'ve run out of brochures." This means:', opts: ['The brochures are now available','They have too many brochures','The brochures are no longer available','The brochures are being printed'], a: 2, exp: '"Run out of" means to have no more of something remaining.' },
    { q: 'A professor mentions "peer-reviewed journals" as sources. This means the research has been:', opts: ['Written by one expert only','Checked by other experts before publication','Published quickly without review','Funded by a university'], a: 1, exp: 'Peer-reviewed = checked and evaluated by experts in the same field before publishing.' },
    { q: 'A student mentions her dissertation "methodology section." This section describes:', opts: ['The conclusion of her research','The background literature','How she conducted her research','Her personal opinions'], a: 2, exp: 'Methodology = the methods used to carry out a study or research.' },
    { q: 'A manager says "We need to streamline our processes." He wants to:', opts: ['Add more steps to the workflow','Make processes more efficient and faster','Hire more staff members','Change the company\'s location'], a: 1, exp: 'Streamline = make (an organization or system) more efficient by simplifying procedures.' },
    { q: 'An academic advisor says the course is "prerequisites free". This means students:', opts: ['Must complete requirements first','Do not need prior qualifications to enrol','Need to pay a fee in advance','Must attend a prerequisite interview'], a: 1, exp: '"Prerequisites free" = no prior requirements needed to join the course.' },
    { q: 'A lecturer says "This finding corroborates earlier research by Smith (2019)." What does this mean?', opts: ['The finding contradicts Smith\'s work','The finding is unrelated to Smith\'s work','The finding supports/confirms Smith\'s work','The finding replaces Smith\'s work'], a: 2, exp: 'Corroborate = confirm or give support to (a statement or theory).' },
  ],
  PTE_Reading: [
    { q: 'Choose the word that best completes the sentence: "The scientists were _____ by the unexpected results of their experiment."', opts: ['baffled','satisfied','predicted','confirmed'], a: 0, exp: 'Baffled = totally confused; the unexpected results caused confusion.' },
    { q: 'Which sentence uses a relative clause correctly?', opts: ['The book which I read it was excellent.','The book, which I read, was excellent.','The book that I read it was excellent.','The book which was I read excellent.'], a: 1, exp: 'Relative clauses are set off by commas when adding non-essential information.' },
    { q: 'The best synonym for "substantial" in academic texts is:', opts: ['minimal','considerable','temporary','gradual'], a: 1, exp: 'Substantial = of considerable importance, size, or worth.' },
    { q: 'Choose the correct form: "The results of the experiment _____ published last year."', opts: ['was','were','is','are'], a: 1, exp: '"Results" is plural, so it takes the plural verb "were".' },
    { q: 'Which phrase signals contrast in academic writing?', opts: ['Furthermore','In addition','Nevertheless','Consequently'], a: 2, exp: 'Nevertheless = in spite of that; introduces a contrasting point.' },
    { q: 'A "hypothesis" in research is best described as:', opts: ['A proven fact','A speculative idea tested by research','A random observation','A final conclusion'], a: 1, exp: 'Hypothesis = a proposed explanation made as a starting point for investigation.' },
    { q: 'Choose the sentence with correct punctuation:', opts: ['The study found three things: efficiency, accuracy and speed.','The study found three things; efficiency, accuracy and speed.','The study found three things, efficiency accuracy and speed.','The study found: three things efficiency, accuracy and speed.'], a: 0, exp: 'A colon introduces a list that follows a complete clause.' },
    { q: '"The CEO, along with her board members, _____ at the meeting." Choose the correct verb:', opts: ['were','are','was','have'], a: 2, exp: '"Along with" does not make a compound subject; verb agrees with CEO (singular = was).' },
    { q: 'Which of these is a compound sentence?', opts: ['She studied hard.','Because she studied, she passed.','She studied hard, and she passed.','Studying hard leads to success.'], a: 2, exp: 'A compound sentence joins two independent clauses with a coordinating conjunction.' },
    { q: '"Nominal" group in academic writing primarily refers to:', opts: ['A noun phrase acting as subject or object','A verb phrase describing action','An adverbial phrase of time','A prepositional phrase of place'], a: 0, exp: 'Nominal group = a noun phrase that functions as subject, object, or complement.' },
  ],
  PTE_Listening: [
    { q: 'A lecturer says: "This phenomenon has far-reaching implications." What does she mean?', opts: ['The effects are limited to one area','The effects extend widely across many areas','The cause is difficult to identify','The phenomenon is not well understood'], a: 1, exp: '"Far-reaching implications" = effects that extend broadly across many areas.' },
    { q: '"The data is robust" means the data is:', opts: ['Small and limited','Strong, reliable and valid','Preliminary and incomplete','Recent and unpublished'], a: 1, exp: 'Robust data = strong, substantial, and reliable; can withstand scrutiny.' },
    { q: 'A professor says: "I\'ll elaborate on this point later." She means she will:', opts: ['Skip this point','Give more detail about this point later','Change the topic entirely','Assign this as homework'], a: 1, exp: 'Elaborate = develop or present in detail.' },
    { q: '"The two findings are consistent with each other" means they:', opts: ['Contradict each other','Support or agree with each other','Were produced at the same time','Were conducted by the same researcher'], a: 1, exp: 'Consistent with = compatible, in agreement with.' },
    { q: 'A news report says: "The policy was implemented with immediate effect." This means:', opts: ['The policy was delayed','The policy started working right away','The policy had little effect','The policy was cancelled'], a: 1, exp: '"With immediate effect" = starting immediately, without delay.' },
    { q: 'A tutor says: "Your essay lacks coherence." What is the main problem?', opts: ['It is too long','It doesn\'t flow logically or connect ideas clearly','It has too many references','It uses informal language'], a: 1, exp: 'Coherence = the quality of being logical and consistent; ideas connecting clearly.' },
    { q: '"The sample size was inadequate" means the study had:', opts: ['Too many participants','Not enough participants for reliable results','Participants who were unqualified','Participants from one location only'], a: 1, exp: 'Inadequate = not sufficient in quality or quantity.' },
    { q: 'An announcer says: "The seminar is scheduled for the penultimate week of term." This means:', opts: ['The last week','The second-to-last week','The first week','The middle week'], a: 1, exp: 'Penultimate = second to last.' },
    { q: '"The argument is circular" in academic context means:', opts: ['The argument considers multiple perspectives','The argument uses the conclusion as its own evidence','The argument is well-rounded and complete','The argument deals with environmental topics'], a: 1, exp: 'A circular argument uses its conclusion as a premise — it doesn\'t advance the reasoning.' },
    { q: 'A researcher says findings are "statistically significant." This means:', opts: ['The findings are very large in number','The probability the result is due to chance is very low','The findings are controversial','The sample was very large'], a: 1, exp: 'Statistical significance = the result is unlikely to have occurred by chance alone.' },
  ],
  GERMAN_A1_Grammatik: [
    { q: 'Welche Form ist korrekt? (I am learning German.)', opts: ['Ich lernst Deutsch.','Ich lerne Deutsch.','Ich lernt Deutsch.','Ich lernen Deutsch.'], a: 1, exp: '"Ich" takes the stem form: lerne (lernen → ich lerne).' },
    { q: 'Was ist der Artikel für "Buch" (book)?', opts: ['der','die','das','den'], a: 2, exp: 'Das Buch — "Buch" is neuter (das).' },
    { q: 'Ergänzen Sie: "_____ heißt du?" (What is your name?)', opts: ['Wie','Was','Wer','Wo'], a: 0, exp: '"Wie heißt du?" = What are you called? "Wie" asks for manner/name.' },
    { q: '"Ich _____ einen Kaffee." (I would like a coffee.)', opts: ['möchte','möchtest','möchten','möchtet'], a: 0, exp: '"Ich möchte" = I would like (modal verb, 1st person singular).' },
    { q: 'What is the correct plural of "Kind" (child)?', opts: ['Kinds','Kinden','Kinder','Kindes'], a: 2, exp: 'Kinder = children (irregular plural of Kind).' },
    { q: 'Which word means "but" in German?', opts: ['und','oder','aber','weil'], a: 2, exp: '"Aber" = but. Und=and, Oder=or, Weil=because.' },
    { q: '"Sie _____ aus Deutschland." (She is from Germany.)', opts: ['kommen','kommt','kommst','komme'], a: 1, exp: '"Sie" (she, singular) uses: kommt (3rd person singular).' },
    { q: 'What is the German for "I have a cat"?', opts: ['Ich bin eine Katze.','Ich habe eine Katze.','Ich haben eine Katze.','Ich hat eine Katze.'], a: 1, exp: '"Haben" = to have. "Ich habe" = I have.' },
    { q: 'Which time expression means "yesterday"?', opts: ['heute','morgen','gestern','jetzt'], a: 2, exp: 'Gestern = yesterday. Heute=today, Morgen=tomorrow, Jetzt=now.' },
    { q: '"Wo _____ du?" (Where do you live?)', opts: ['wohnst','wohne','wohnt','wohnen'], a: 0, exp: '"Du" takes the -st ending: wohnst (du wohnst = you live).' },
  ],
  GERMAN_A1_Wortschatz: [
    { q: 'What does "Krankenhaus" mean?', opts: ['School','Hospital','Library','Train station'], a: 1, exp: 'Krankenhaus = hospital (krank=sick, Haus=house → sick-house).' },
    { q: 'Which word means "apple"?', opts: ['Birne','Apfel','Banane','Orange'], a: 1, exp: 'Apfel = apple. Birne=pear, Banane=banana.' },
    { q: '"Ich spreche kein Englisch" means:', opts: ['I speak English','I don\'t speak English','I speak a little English','I want to learn English'], a: 1, exp: '"Kein" = no/not a; "spreche kein Englisch" = speak no English.' },
    { q: 'What does "Entschuldigung" mean?', opts: ['Thank you','Good morning','Excuse me / Sorry','Goodbye'], a: 2, exp: 'Entschuldigung = Excuse me / Sorry (apology/getting attention).' },
    { q: 'Which word means "expensive"?', opts: ['billig','teuer','neu','alt'], a: 1, exp: 'Teuer = expensive. Billig=cheap, Neu=new, Alt=old.' },
    { q: 'What is the German for "month"?', opts: ['Jahr','Woche','Tag','Monat'], a: 3, exp: 'Monat = month. Jahr=year, Woche=week, Tag=day.' },
    { q: '"Ich bin müde" means:', opts: ['I am hungry','I am happy','I am tired','I am cold'], a: 2, exp: 'Müde = tired. Hungry=hungrig, Happy=glücklich, Cold=kalt.' },
    { q: 'Which is a German greeting for "Good evening"?', opts: ['Guten Morgen','Guten Tag','Guten Abend','Auf Wiedersehen'], a: 2, exp: 'Guten Abend = Good evening. Morgen=morning, Tag=day/afternoon.' },
    { q: 'What does "Bahnhof" mean?', opts: ['Airport','Bus stop','Train station','Taxi stand'], a: 2, exp: 'Bahnhof = train station (Bahn=train/rail, Hof=courtyard/station).' },
    { q: '"Ich verstehe nicht" means:', opts: ['I do not agree','I do not understand','I cannot see','I do not want'], a: 1, exp: 'Verstehen = to understand; "nicht" = not → I do not understand.' },
  ],
  GERMAN_A1_Lesen: [
    { passage: 'Mein Name ist Anna. Ich bin 22 Jahre alt und komme aus Berlin. Ich studiere Medizin an der Universität. Meine Hobbys sind Lesen, Musik und Sport. Ich habe einen Hund. Er heißt Max.', q: 'Wie alt ist Anna?', opts: ['20','22','25','30'], a: 1, exp: '"Ich bin 22 Jahre alt" = I am 22 years old.' },
    { q: 'What does Anna study?', opts: ['Engineering','Law','Medicine','Languages'], a: 2, exp: '"Ich studiere Medizin" = I study medicine.' },
    { q: 'What is Anna\'s dog called?', opts: ['Rex','Fritz','Max','Bruno'], a: 2, exp: '"Er heißt Max" = He is called Max.' },
    { q: 'Which hobby is NOT mentioned?', opts: ['Reading','Music','Cooking','Sport'], a: 2, exp: 'The text lists Lesen (reading), Musik, and Sport — not Kochen (cooking).' },
    { q: 'Where is Anna from?', opts: ['Munich','Hamburg','Vienna','Berlin'], a: 3, exp: '"Ich komme aus Berlin" = I come from Berlin.' },
    { passage: 'Der Supermarkt ist montags bis samstags von 8 bis 20 Uhr geöffnet. Sonntags ist er geschlossen. Das Café nebenan öffnet um 7 Uhr und schließt um 18 Uhr.', q: 'When is the supermarket closed?', opts: ['Monday','Friday','Saturday','Sunday'], a: 3, exp: '"Sonntags ist er geschlossen" = On Sundays it is closed.' },
    { q: 'What time does the café open?', opts: ['6:00','7:00','8:00','9:00'], a: 1, exp: '"Das Café öffnet um 7 Uhr" = The café opens at 7 o\'clock.' },
    { q: 'Until what time is the supermarket open on weekdays?', opts: ['18:00','19:00','20:00','21:00'], a: 2, exp: '"von 8 bis 20 Uhr" = from 8 to 20 (8pm).' },
    { q: 'What does "nebenan" mean in context?', opts: ['above','opposite','next door','below'], a: 2, exp: 'Nebenan = next door / nearby.' },
    { q: 'Which days is the supermarket open?', opts: ['Tuesday to Sunday','Monday to Saturday','Monday to Sunday','Wednesday to Sunday'], a: 1, exp: '"montags bis samstags" = Monday to Saturday.' },
  ],
  GERMAN_B1_Grammatik: [
    { q: 'Choose the correct Konjunktiv II form: "If I were rich, I _____ a house."', opts: ['kaufe','kaufte','würde kaufen','gekauft habe'], a: 2, exp: 'Konjunktiv II uses "würde + infinitive" for conditional sentences.' },
    { q: 'Which sentence uses the Genitive case correctly?', opts: ['das Auto von meinem Vater','das Auto meines Vaters','das Auto meinem Vater','das Auto meinen Vater'], a: 1, exp: '"Meines Vaters" = of my father (genitive masculine: des → meines).' },
    { q: 'In a relative clause, choose the correct pronoun: "Der Mann, _____ ich gesehen habe, war mein Lehrer."', opts: ['der','den','dem','dessen'], a: 1, exp: '"Den" — accusative masculine, because "gesehen habe" requires accusative object.' },
    { q: '"Obwohl es regnete, _____ wir spazieren." (Although it rained, we went for a walk.)', opts: ['gingen','gingen wir','wir gingen','sind wir gegangen'], a: 0, exp: 'After "obwohl" (subordinating conj), verb goes to end but main clause is normal order.' },
    { q: 'Choose the correct reflexive: "Er _____ die Hände." (He washes his hands.)', opts: ['wäscht sich','sich wäscht','wäscht ihm','ihm wäscht'], a: 0, exp: '"Sich waschen" = to wash oneself; Er wäscht sich die Hände (reflexive + direct object).' },
    { q: 'Which Präteritum form of "fahren" is correct for "wir"?', opts: ['fuhren','fährten','gefahren','fahrenten'], a: 0, exp: 'Fahren is a strong verb: fahren → fuhr → wir fuhren (Präteritum plural).' },
    { q: '"Das Buch, _____ ich lese, ist sehr interessant." (The book that I am reading is very interesting.)', opts: ['der','das','die','den'], a: 1, exp: 'Buch is neuter (das), so the relative pronoun is also "das".' },
    { q: 'What mood does "Könnten Sie mir bitte helfen?" use?', opts: ['Indikativ','Imperativ','Konjunktiv I','Konjunktiv II'], a: 3, exp: '"Könnten" is the Konjunktiv II of können — used for polite requests.' },
    { q: 'Which connector correctly joins cause and effect? "Er war krank, _____ konnte er nicht kommen."', opts: ['deshalb','obwohl','damit','falls'], a: 0, exp: '"Deshalb" = therefore/that is why (causes a result/consequence).' },
    { q: 'Choose the correct passive voice: "Das Haus _____ 1990 gebaut." (The house was built in 1990.)', opts: ['ist','wird','wurde','hat'], a: 2, exp: 'Passiv Präteritum: wurde + past participle (wurde gebaut = was built).' },
  ],
  IELTS_Mock: [
    { q: 'The passive voice of "Scientists discovered the cure" is:', opts: ['The cure discovered scientists.','The cure was discovered by scientists.','Scientists were discovered the cure.','The cure has scientists discovering it.'], a: 1, exp: 'Passive: Object + was/were + past participle + by + agent.' },
    { q: 'Choose the word that does NOT belong: efficiency, productivity, lethargy, output', opts: ['efficiency','productivity','lethargy','output'], a: 2, exp: 'Lethargy = lack of energy; the others all relate to positive performance measures.' },
    { q: 'Reading: "The policy yielded significant results." What does "yielded" mean here?', opts: ['blocked','surrendered','produced','required'], a: 2, exp: 'Yield = produce or provide (a result, natural product, or financial return).' },
    { q: 'Which sentence demonstrates hedging language?', opts: ['This proves that climate change is caused by humans.','The data suggests that climate change may be influenced by human activity.','Everyone knows climate change is a myth.','Climate change definitely does not affect sea levels.'], a: 1, exp: 'Hedging uses "suggests", "may", "could" to avoid absolute claims — academic style.' },
    { q: 'The word "albeit" most closely means:', opts: ['although','therefore','moreover','consequently'], a: 0, exp: '"Albeit" = although, even though (e.g., "a small albeit significant improvement").' },
    { q: '"The findings are inconclusive" means:', opts: ['The findings are very clear','The findings do not lead to a definite answer','The findings are incorrect','The findings are being reviewed'], a: 1, exp: 'Inconclusive = not leading to a firm conclusion; results are unclear.' },
    { q: 'Choose the correct article: "She is _____ honest person."', opts: ['a','an','the','—'], a: 1, exp: '"An" before words beginning with a vowel sound ("honest" starts with /ɒn/ sound).' },
    { q: 'What does "substantiate" a claim mean?', opts: ['Make it shorter','Make it more complex','Provide evidence to support it','Dispute it with counter-arguments'], a: 2, exp: 'Substantiate = provide evidence to support or prove the truth of (a claim).' },
    { q: 'Which of these is a cohesive device?', opts: ['therefore','table','frequency','questionnaire'], a: 0, exp: '"Therefore" is a cohesive/linking device showing logical consequence.' },
    { q: '"To contend" in academic writing means:', opts: ['to agree without question','to claim or assert (an argument)','to calculate a result','to summarise findings'], a: 1, exp: 'Contend = to claim/assert as a position; often used for academic arguments.' },
    { q: 'The prefix "mis-" in "misinterpret" means:', opts: ['again','wrongly','not','before'], a: 1, exp: 'Mis- = wrongly (misinterpret = interpret wrongly).' },
    { q: 'Which tense is correct? "By 2030, renewable energy _____ 50% of global electricity."', opts: ['will produce','will have produced','produces','produced'], a: 1, exp: 'Future perfect = will have + past participle; for completion before a future point.' },
    { q: 'A "dichotomy" refers to:', opts: ['a gradual process','a division into two contrasting parts','a unanimous decision','a cyclical pattern'], a: 1, exp: 'Dichotomy = a division or contrast between two things that are opposite.' },
    { q: 'Reading: "The surge in demand outpaced supply." "Outpaced" means:', opts: ['matched exactly','fell behind','exceeded/went faster than','temporarily halted'], a: 2, exp: 'Outpace = go faster than; exceed the rate of (supply).' },
    { q: '"Despite + noun/gerund" introduces:', opts: ['a cause','a result','a concession/contrast','a condition'], a: 2, exp: '"Despite" = in spite of — introduces a contrasting idea (concessive clause).' },
    { q: 'Which academic phrase signals an example?', opts: ['In conclusion','Conversely','For instance','In contrast'], a: 2, exp: '"For instance" = for example — introduces a specific illustration of a point.' },
    { q: 'Choose the correct reported speech: She said, "I will finish the report tomorrow."', opts: ['She said she will finish the report tomorrow.','She said she would finish the report the next day.','She said I will finish the report tomorrow.','She said she finished the report tomorrow.'], a: 1, exp: 'Reported speech: will → would; tomorrow → the next day; direct pronouns change.' },
    { q: '"The study is longitudinal" means:', opts: ['It covers one specific moment in time','It follows subjects over an extended period','It involves many different countries','It uses a very large sample'], a: 1, exp: 'Longitudinal study = research conducted over a long period to observe development.' },
    { q: 'Which is an example of a discourse marker for addition?', opts: ['However','Furthermore','Although','Otherwise'], a: 1, exp: '"Furthermore" adds to a previous point. However/Although = contrast; Otherwise = condition.' },
    { q: '"Extrapolate" data means to:', opts: ['delete irrelevant data','extend conclusions beyond observed data','compare data from two sources','calculate the average of data'], a: 1, exp: 'Extrapolate = extend the application of (a method or conclusion) to unknown situations.' },
  ],
};

// ─── SVG CHARTS ──────────────────────────────────────────────
function RadialProgress({ pct = 0, size = 120, strokeWidth = 10, color = '#3b82f6', label = '', subLabel = '', bg = '#e2e8f0' }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ marginTop: -size * 0.6 - 4, textAlign: 'center' }}>
        <div className="font-black text-slate-900" style={{ fontSize: size * 0.18 }}>{label}</div>
        {subLabel && <div className="text-slate-400 font-medium" style={{ fontSize: size * 0.11 }}>{subLabel}</div>}
      </div>
      <div style={{ height: size * 0.4 }} />
    </div>
  );
}

function LineChart({ data = [], color = '#3b82f6', height = 80 }) {
  if (!data.length) return <div className="text-xs text-slate-400 text-center py-4">No data yet</div>;
  const values = data.map(d => d.value);
  const mn = Math.min(...values, 0);
  const mx = Math.max(...values, 100);
  const range = mx - mn || 1;
  const w = 300, h = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * (w - 20) + 10;
    const y = h - 10 - ((d.value - mn) / range) * (h - 20);
    return `${x},${y}`;
  });
  const path = 'M ' + pts.join(' L ');
  const fillPts = [...pts, `${(w-10)},${h}`, `10,${h}`];
  const fill = 'M ' + fillPts.join(' L ') + ' Z';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#lg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * (w - 20) + 10;
        const y = h - 10 - ((d.value - mn) / range) * (h - 20);
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function BarRow({ label, pct = 0, color = '#3b82f6', score = '', best = '', attempts = 0 }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-slate-700 truncate max-w-[140px]">{label}</span>
        <span className="flex items-center gap-2 text-slate-500 flex-shrink-0">
          {attempts > 0 && <span className="text-slate-400">{attempts} try</span>}
          {best && <span className="font-bold" style={{ color }}>Best: {best}</span>}
          <span className="font-black text-slate-800">{score || `${Math.round(pct)}%`}</span>
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)` }} />
      </div>
    </div>
  );
}

// ─── SCORE HELPERS ────────────────────────────────────────────
function scoreColor(pct) {
  if (pct >= 75) return '#16a34a';
  if (pct >= 55) return '#f59e0b';
  return '#ef4444';
}
function scoreGrade(pct) {
  if (pct >= 85) return 'Excellent'; if (pct >= 70) return 'Good';
  if (pct >= 55) return 'Average'; if (pct >= 40) return 'Below Average';
  return 'Needs Work';
}
function daysLeft(targetDate) {
  const diff = new Date(targetDate) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
function weeksBetween(d1, d2) { return Math.max(1, Math.ceil((new Date(d2) - new Date(d1)) / (7 * 86400000))); }

// ─── DYNAMIC STUDY PLAN ───────────────────────────────────────
function StudyPlan({ target, testScores, enrolledCourses }) {
  if (!target) return null;
  const examDef = EXAMS[target.exam_type] || EXAMS.IELTS;
  const days = daysLeft(target.target_date);
  const weeks = Math.ceil(days / 7);
  const hours = parseFloat(target.study_hours_per_day) || 2;
  const totalHours = Math.round(days * hours);

  // Score analysis
  const scoreMap = {};
  testScores.forEach(s => { scoreMap[s.module_name] = parseFloat(s.avg_score) || 0; });
  const modules = examDef.modules;
  const avgScore = modules.reduce((sum, m) => sum + (scoreMap[m] || 0), 0) / modules.length;
  const weakModules = modules.filter(m => (scoreMap[m] || 0) < 60).sort((a, b) => (scoreMap[a] || 0) - (scoreMap[b] || 0));
  const strongModules = modules.filter(m => (scoreMap[m] || 0) >= 75);

  // Weekly milestone plan
  const milestones = [];
  for (let w = 1; w <= Math.min(weeks, 12); w++) {
    const progress = w / Math.min(weeks, 12);
    const targetPct = examDef.targetToPct(target.target_score);
    const currentPct = avgScore;
    const weekTarget = Math.round(currentPct + (targetPct - currentPct) * progress);
    milestones.push({ week: w, target: weekTarget, focus: weakModules[((w - 1) % Math.max(weakModules.length, 1))] || modules[w % modules.length] });
  }

  // Daily schedule
  const schedule = [];
  const days7 = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  modules.forEach((mod, i) => {
    schedule.push({ day: days7[i % 7], activity: mod, priority: weakModules.includes(mod) ? 'High' : 'Normal', hours: weakModules.includes(mod) ? Math.min(hours, 2) : Math.max(0.5, hours * 0.7) });
  });
  if (weeks >= 2) schedule.push({ day: 'Sun', activity: 'Mock Test + Review', priority: 'High', hours: 2 });

  const colMap = { High: '#ef4444', Normal: '#3b82f6' };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Days to Exam', val: days, icon: '📅', color: days < 30 ? '#ef4444' : '#3b82f6' },
          { label: 'Study Hours Left', val: totalHours + 'h', icon: '⏱️', color: '#8b5cf6' },
          { label: 'Target Score', val: examDef.toDisplay(examDef.targetToPct(target.target_score)), icon: '🎯', color: '#16a34a' },
          { label: 'Current Avg', val: avgScore > 0 ? examDef.toDisplay(avgScore) : '—', icon: '📊', color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-xl font-black" style={{ color: c.color }}>{c.val}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Module readiness */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h4 className="font-black text-slate-900 mb-1">Module Readiness</h4>
        <p className="text-xs text-slate-400 mb-4">Based on your test history. Take module tests to update.</p>
        {modules.map(mod => {
          const sc = scoreMap[mod] || 0;
          return <BarRow key={mod} label={mod} pct={sc} color={scoreColor(sc)} score={sc > 0 ? `${Math.round(sc)}%` : 'Not tested'} />;
        })}
      </div>

      {/* Focus areas */}
      {(weakModules.length > 0 || strongModules.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {weakModules.length > 0 && (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <h4 className="font-bold text-red-700 text-sm mb-2">🎯 Focus Areas</h4>
              {weakModules.slice(0, 4).map(m => (
                <div key={m} className="flex items-center gap-2 text-xs text-red-600 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {m} — {scoreMap[m] ? Math.round(scoreMap[m]) + '%' : 'untested'}
                </div>
              ))}
            </div>
          )}
          {strongModules.length > 0 && (
            <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
              <h4 className="font-bold text-green-700 text-sm mb-2">✅ Strong Areas</h4>
              {strongModules.slice(0, 4).map(m => (
                <div key={m} className="flex items-center gap-2 text-xs text-green-700 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  {m} — {Math.round(scoreMap[m])}%
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly milestones */}
      {weeks > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h4 className="font-black text-slate-900 mb-4">📈 Weekly Score Milestones</h4>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {milestones.slice(0, 10).map(m => (
                <div key={m.week} className="flex flex-col items-center gap-1 min-w-[60px]">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white"
                    style={{ background: `linear-gradient(135deg, ${examDef.color}, ${examDef.color}99)` }}>
                    {m.target}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Wk {m.week}</div>
                  <div className="text-[9px] text-slate-400 text-center leading-tight max-w-[56px] truncate">{m.focus}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily study schedule */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h4 className="font-black text-slate-900 mb-4">📅 Recommended Daily Schedule</h4>
        <div className="space-y-2">
          {schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
              <div className="w-10 text-xs font-black text-center text-slate-500">{s.day}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-800">{s.activity}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{s.hours}h</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: colMap[s.priority] + '20', color: colMap[s.priority] }}>{s.priority}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI recommendations */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
        <h4 className="font-black text-slate-900 mb-3">💡 Smart Recommendations</h4>
        <ul className="space-y-2 text-sm text-slate-700">
          {days < 14 && <li className="flex items-start gap-2"><span>⚠️</span><span>Less than 2 weeks to exam — focus only on your top 2 weak areas and do daily mock tests.</span></li>}
          {days >= 14 && days < 30 && <li className="flex items-start gap-2"><span>⏰</span><span>1 month left: Alternate between weak module practice and full mock tests every 3 days.</span></li>}
          {days >= 30 && <li className="flex items-start gap-2"><span>📚</span><span>Good time ahead — build strong foundations in weak modules before moving to full mocks.</span></li>}
          {hours < 2 && <li className="flex items-start gap-2"><span>📈</span><span>Consider increasing to at least 2 hours/day — consistency beats intensity for language exams.</span></li>}
          {weakModules.length > 0 && <li className="flex items-start gap-2"><span>🎯</span><span>Spend 60% of study time on: <strong>{weakModules.slice(0,2).join(', ')}</strong> — your lowest scoring areas.</span></li>}
          <li className="flex items-start gap-2"><span>🧪</span><span>Take at least one full mock test per week to build exam stamina and time management.</span></li>
          <li className="flex items-start gap-2"><span>🔁</span><span>Review all incorrect answers within 24 hours — spaced repetition dramatically improves retention.</span></li>
          {target.exam_type.startsWith('GERMAN') && <li className="flex items-start gap-2"><span>🗣️</span><span>For German: daily 10-min speaking practice with a partner or app (Tandem, HelloTalk) is essential.</span></li>}
          {(target.exam_type === 'IELTS') && <li className="flex items-start gap-2"><span>✍️</span><span>IELTS Writing: practise Task 1 (20 min) and Task 2 (40 min) timed every session. Get feedback.</span></li>}
          {(target.exam_type === 'PTE') && <li className="flex items-start gap-2"><span>🎙️</span><span>PTE Speaking: record yourself and compare pronunciation. Fluency scoring is automated.</span></li>}
        </ul>
      </div>
    </div>
  );
}

// ─── TEST RUNNER ──────────────────────────────────────────────
function TestRunner({ examType, moduleName, testType = 'module', questions, onComplete }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [startTime] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [showExp, setShowExp] = useState(false);

  const q = questions[current];
  const totalQ = questions.length;

  const selectAnswer = (idx) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [current]: idx }));
  };

  const handleSubmit = async () => {
    const timeSecs = Math.round((Date.now() - startTime) / 1000);
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.a) correct++; });
    const pct = Math.round((correct / totalQ) * 100);
    const examDef = EXAMS[examType] || EXAMS.IELTS;
    const bandScore = examDef.toDisplay(pct);

    const resultData = { correct, total: totalQ, pct, bandScore, timeSecs };
    setResult(resultData);
    setSubmitted(true);

    setSaving(true);
    try {
      await api.post('/student/tests/submit', {
        exam_type: examType, module_name: moduleName, test_type: testType,
        score_percent: pct, band_score: parseFloat(bandScore) || null,
        total_questions: totalQ, correct_answers: correct, time_taken_seconds: timeSecs,
        answers_json: answers,
      });
    } catch (e) { console.error('Save error:', e); }
    setSaving(false);
  };

  if (submitted && result) {
    const col = scoreColor(result.pct);
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
        <div className="text-5xl mb-3">{result.pct >= 75 ? '🎉' : result.pct >= 55 ? '👍' : '💪'}</div>
        <h3 className="text-xl font-black text-slate-900 mb-1">{moduleName} Complete!</h3>
        <p className="text-slate-400 text-sm mb-5">{examType} · {testType === 'mock' ? 'Mock Test' : 'Module Test'}</p>
        <div className="flex justify-center gap-6 mb-6">
          <div><div className="text-3xl font-black" style={{ color: col }}>{result.pct}%</div><div className="text-xs text-slate-400">Score</div></div>
          <div><div className="text-3xl font-black" style={{ color: col }}>{result.bandScore}</div><div className="text-xs text-slate-400">{(EXAMS[examType]||EXAMS.IELTS).scoreLabel}</div></div>
          <div><div className="text-3xl font-black text-slate-700">{result.correct}/{result.total}</div><div className="text-xs text-slate-400">Correct</div></div>
          <div><div className="text-3xl font-black text-slate-700">{Math.round(result.timeSecs/60)}m</div><div className="text-xs text-slate-400">Time</div></div>
        </div>
        <div className="text-sm font-bold px-4 py-2 rounded-full inline-block mb-5" style={{ background: col + '20', color: col }}>{scoreGrade(result.pct)}</div>

        <div className="text-left mb-5">
          <button onClick={() => setShowExp(!showExp)} className="text-blue-600 text-sm font-semibold hover:underline">
            {showExp ? '▲ Hide' : '▼ Show'} Answer Review
          </button>
          {showExp && (
            <div className="mt-3 space-y-3">
              {questions.map((q, i) => (
                <div key={i} className={`p-3 rounded-xl text-sm border ${answers[i] === q.a ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="font-semibold text-slate-800 mb-1">Q{i+1}: {q.q?.slice(0,80)}</div>
                  <div className={answers[i] === q.a ? 'text-green-700' : 'text-red-600'}>
                    Your answer: {q.opts[answers[i]] ?? '—'} {answers[i] === q.a ? '✓' : `✗ (Correct: ${q.opts[q.a]})`}
                  </div>
                  {q.exp && <div className="text-slate-500 text-xs mt-1">{q.exp}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={onComplete} className="px-5 py-2 rounded-xl text-white font-bold text-sm" style={{ background: '#1e40af' }}>← Back to Tests</button>
          {saving && <span className="text-xs text-slate-400 self-center">Saving...</span>}
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="font-black text-slate-900">{moduleName}</div>
          <div className="text-xs text-slate-400">{examType} · {totalQ} questions</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{answered}/{totalQ} answered</span>
          {answered === totalQ && (
            <button onClick={handleSubmit} className="px-4 py-2 rounded-xl text-white font-bold text-sm" style={{ background: '#16a34a' }}>Submit Test</button>
          )}
          <button onClick={onComplete} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${((current + 1) / totalQ) * 100}%` }} />
      </div>

      {/* Question */}
      <div className="p-5">
        {q.passage && (
          <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600 leading-relaxed border border-slate-200 max-h-32 overflow-y-auto">
            {q.passage}
          </div>
        )}
        <div className="flex items-start gap-3 mb-5">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-black flex items-center justify-center">{current + 1}</span>
          <p className="font-semibold text-slate-900 leading-relaxed pt-1">{q.q}</p>
        </div>
        <div className="space-y-2.5">
          {q.opts.map((opt, i) => {
            const sel = answers[current] === i;
            return (
              <button key={i} onClick={() => selectAnswer(i)}
                className="w-full text-left flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all font-medium text-sm"
                style={{ borderColor: sel ? '#3b82f6' : '#e2e8f0', background: sel ? '#eff6ff' : '#fff', color: sel ? '#1e40af' : '#475569' }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: sel ? '#3b82f6' : '#f1f5f9', color: sel ? '#fff' : '#94a3b8' }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-5 pb-5 flex items-center justify-between">
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">← Prev</button>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-7 h-7 rounded-lg text-xs font-bold transition"
              style={{ background: i === current ? '#3b82f6' : answers[i] !== undefined ? '#16a34a' : '#f1f5f9', color: i === current || answers[i] !== undefined ? '#fff' : '#94a3b8' }}>
              {i + 1}
            </button>
          ))}
        </div>
        {current < totalQ - 1
          ? <button onClick={() => setCurrent(c => c + 1)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition">Next →</button>
          : <button onClick={handleSubmit} disabled={answered < totalQ} className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition">Submit ✓</button>
        }
      </div>
    </div>
  );
}

// ─── MODULE TESTS LIST ────────────────────────────────────────
function TEST_CATALOG(enrolledCourses) {
  const catalog = [];
  const addTest = (examType, moduleName, testType, qs) => {
    if (qs && qs.length >= 5) catalog.push({ examType, moduleName, testType, questions: qs });
  };

  // IELTS tests — always available
  addTest('IELTS', 'Grammar', 'module', QB.IELTS_Grammar);
  addTest('IELTS', 'Vocabulary', 'module', QB.IELTS_Vocabulary);
  addTest('IELTS', 'Reading', 'module', QB.IELTS_Reading);
  addTest('IELTS', 'Listening', 'module', QB.IELTS_Listening);
  addTest('IELTS', 'Full Mock', 'mock', QB.IELTS_Mock);
  // PTE tests
  addTest('PTE', 'Reading', 'module', QB.PTE_Reading);
  addTest('PTE', 'Listening', 'module', QB.PTE_Listening);
  addTest('PTE', 'Grammar', 'module', QB.IELTS_Grammar); // shared grammar
  addTest('PTE', 'Full Mock', 'mock', [...QB.PTE_Reading.slice(0,5), ...QB.PTE_Listening.slice(0,5), ...QB.IELTS_Grammar.slice(0,5), ...QB.IELTS_Vocabulary.slice(0,5)]);
  // German A1
  addTest('GERMAN_A1', 'Grammatik', 'module', QB.GERMAN_A1_Grammatik);
  addTest('GERMAN_A1', 'Wortschatz', 'module', QB.GERMAN_A1_Wortschatz);
  addTest('GERMAN_A1', 'Lesen', 'module', QB.GERMAN_A1_Lesen);
  addTest('GERMAN_A1', 'Full Mock', 'mock', [...QB.GERMAN_A1_Grammatik.slice(0,7), ...QB.GERMAN_A1_Wortschatz.slice(0,7), ...QB.GERMAN_A1_Lesen.slice(0,6)]);
  // German B1
  addTest('GERMAN_B1', 'Grammatik', 'module', QB.GERMAN_B1_Grammatik);
  addTest('GERMAN_B1', 'Wortschatz', 'module', QB.GERMAN_A1_Wortschatz.map(q => ({...q, q: q.q + ' (B1)' }))); // placeholder
  addTest('GERMAN_B1', 'Full Mock', 'mock', [...QB.GERMAN_B1_Grammatik, ...QB.GERMAN_A1_Wortschatz.slice(0,10)]);

  return catalog;
}

function ModuleTestsList({ examFilter, testHistory, onStartTest, accent }) {
  const [activeExam, setActiveExam] = useState(examFilter || 'ALL');
  const catalog = TEST_CATALOG([]);

  // Compute last score per module from history
  const lastScores = {};
  testHistory.forEach(h => {
    const key = `${h.exam_type}_${h.module_name}`;
    if (!lastScores[key] || new Date(h.created_at) > new Date(lastScores[key].created_at)) {
      lastScores[key] = h;
    }
  });

  const exams = ['ALL', ...Object.keys(EXAMS)];
  const filtered = activeExam === 'ALL' ? catalog : catalog.filter(t => t.examType === activeExam);

  const groupedByExam = {};
  filtered.forEach(t => {
    if (!groupedByExam[t.examType]) groupedByExam[t.examType] = [];
    groupedByExam[t.examType].push(t);
  });

  return (
    <div>
      {/* Exam filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {exams.map(ex => (
          <button key={ex} onClick={() => setActiveExam(ex)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition"
            style={{ background: activeExam === ex ? accent : '#f1f5f9', color: activeExam === ex ? '#fff' : '#64748b' }}>
            {ex === 'ALL' ? '🌐 All Exams' : `${EXAMS[ex]?.icon} ${EXAMS[ex]?.label?.split(' ')[0]} ${EXAMS[ex]?.label?.split(' ')[1] || ''}`}
          </button>
        ))}
      </div>

      {Object.entries(groupedByExam).map(([exam, tests]) => {
        const def = EXAMS[exam] || EXAMS.IELTS;
        return (
          <div key={exam} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{def.icon}</span>
              <h3 className="font-black text-slate-900">{def.label}</h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{tests.length} tests</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tests.map(t => {
                const key = `${t.examType}_${t.moduleName}`;
                const last = lastScores[key];
                const col = last ? scoreColor(parseFloat(last.score_percent)) : def.color;
                return (
                  <div key={key} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition group">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-black text-slate-900 text-sm">{t.moduleName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{t.testType === 'mock' ? '🏆 Mock Test' : '📝 Module Test'} · {t.questions.length} questions</div>
                      </div>
                      {last && (
                        <div className="text-right">
                          <div className="font-black text-sm" style={{ color: col }}>{Math.round(last.score_percent)}%</div>
                          <div className="text-[10px] text-slate-400">{def.toDisplay(parseFloat(last.score_percent))} {def.scoreLabel}</div>
                        </div>
                      )}
                    </div>
                    {last && (
                      <div className="mb-3">
                        <BarRow label="" pct={parseFloat(last.score_percent)} color={col} />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      {last
                        ? <span className="text-xs text-slate-400">{new Date(last.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        : <span className="text-xs text-amber-600 font-semibold">Not attempted</span>}
                      <button onClick={() => onStartTest(t)}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-white transition group-hover:opacity-90"
                        style={{ background: `linear-gradient(135deg, ${def.color}, ${def.color}cc)` }}>
                        {last ? 'Retry' : 'Start'} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PERFORMANCE DASHBOARD ────────────────────────────────────
function PerformanceDashboard({ progress, accent }) {
  const { testScores = [], recentAttempts = [], weeklyProgress = [], target, enrolledCourses = [], attendance } = progress;

  const examDef = target ? (EXAMS[target.exam_type] || EXAMS.IELTS) : EXAMS.IELTS;
  const targetPct = target ? examDef.targetToPct(target.target_score) : 70;
  const avgScore = testScores.length > 0
    ? Math.round(testScores.reduce((s, r) => s + parseFloat(r.avg_score || 0), 0) / testScores.length)
    : 0;
  const attPct = attendance?.total_classes > 0
    ? Math.round((attendance.attended / attendance.total_classes) * 100) : 0;
  const lineData = weeklyProgress.map(w => ({
    value: parseFloat(w.avg_score) || 0,
    label: `Wk ${w.wk}`,
  }));

  // Group scores by exam
  const byExam = {};
  testScores.forEach(s => {
    if (!byExam[s.exam_type]) byExam[s.exam_type] = [];
    byExam[s.exam_type].push(s);
  });

  return (
    <div className="space-y-5">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <RadialProgress pct={avgScore} size={90} strokeWidth={8} color={scoreColor(avgScore)} label={avgScore > 0 ? `${avgScore}%` : '—'} subLabel="Avg Score" />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <RadialProgress pct={attPct} size={90} strokeWidth={8} color="#3b82f6" label={`${attPct}%`} subLabel="Attendance" />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <RadialProgress pct={targetPct > 0 && avgScore > 0 ? Math.min(100, Math.round((avgScore / targetPct) * 100)) : 0} size={90} strokeWidth={8} color="#16a34a" label={target ? examDef.toDisplay(avgScore) : '—'} subLabel="vs Target" />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center flex flex-col justify-center">
          <div className="text-3xl font-black text-slate-900">{recentAttempts.length}</div>
          <div className="text-xs text-slate-400 font-medium mt-1">Tests Taken</div>
          <div className="text-xl font-black text-blue-600 mt-1">{attendance?.attended || 0}</div>
          <div className="text-xs text-slate-400">Classes Attended</div>
        </div>
      </div>

      {/* Weekly trend */}
      {lineData.length > 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-black text-slate-900">📈 Progress Trend (Last 10 Weeks)</h4>
            {target && <span className="text-xs text-slate-400">Target: {target.target_score} {examDef.scoreLabel}</span>}
          </div>
          <LineChart data={lineData} color={accent} height={90} />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-2">
            {lineData.map((d, i) => <span key={i}>{d.label}</span>)}
          </div>
        </div>
      )}

      {/* Per-exam module breakdown */}
      {Object.entries(byExam).map(([exam, scores]) => {
        const def = EXAMS[exam] || EXAMS.IELTS;
        return (
          <div key={exam} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h4 className="font-black text-slate-900 mb-1">{def.icon} {def.label} — Module Scores</h4>
            <p className="text-xs text-slate-400 mb-4">{def.scoreInfo}</p>
            {scores.map(s => (
              <BarRow key={s.module_name} label={s.module_name}
                pct={parseFloat(s.avg_score) || 0}
                color={scoreColor(parseFloat(s.avg_score))}
                score={def.toDisplay(parseFloat(s.avg_score))}
                best={def.toDisplay(parseFloat(s.best_score))}
                attempts={s.attempts}
              />
            ))}
          </div>
        );
      })}

      {testScores.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
          <div className="text-4xl mb-3">📝</div>
          <p className="font-bold text-slate-700 mb-1">No test results yet</p>
          <p className="text-sm text-slate-400">Take module tests to see your performance here</p>
        </div>
      )}

      {/* Recent attempts */}
      {recentAttempts.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h4 className="font-black text-slate-900 mb-4">🕐 Recent Test History</h4>
          <div className="space-y-2">
            {recentAttempts.slice(0, 10).map(a => {
              const def = EXAMS[a.exam_type] || EXAMS.IELTS;
              const col = scoreColor(parseFloat(a.score_percent));
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: def.color + '20' }}>{def.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{a.module_name}</div>
                    <div className="text-xs text-slate-400">{a.exam_type} · {a.correct_answers}/{a.total_questions} correct</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-sm" style={{ color: col }}>{Math.round(a.score_percent)}%</div>
                    <div className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ATTENDANCE VIEW ──────────────────────────────────────────
function AttendanceView({ progress }) {
  const { attendance, recentClasses = [] } = progress;
  const total = parseInt(attendance?.total_classes) || 0;
  const attended = parseInt(attendance?.attended) || 0;
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
  const totalMins = Math.round((parseInt(attendance?.total_seconds) || 0) / 60);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Attendance Rate', val: `${pct}%`, icon: '📊', color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#f59e0b' : '#ef4444' },
          { label: 'Classes Attended', val: attended, icon: '✅', color: '#3b82f6' },
          { label: 'Total Scheduled', val: total, icon: '📅', color: '#64748b' },
          { label: 'Time in Class', val: totalMins >= 60 ? `${Math.round(totalMins/60)}h ${totalMins%60}m` : `${totalMins}m`, icon: '⏱️', color: '#8b5cf6' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-2xl font-black" style={{ color: c.color }}>{c.val}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-black text-slate-900">Attendance Rate</h4>
          <span className="text-sm font-bold" style={{ color: pct >= 80 ? '#16a34a' : '#f59e0b' }}>
            {pct >= 80 ? '🌟 Excellent' : pct >= 60 ? '👍 Good' : '⚠️ Needs Improvement'}
          </span>
        </div>
        <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #3b82f6, ${pct >= 80 ? '#16a34a' : '#f59e0b'})` }}>
            <span className="text-xs font-black text-white">{pct}%</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>0%</span><span>Target: 80%</span><span>100%</span>
        </div>
        {pct < 75 && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
            ⚠️ Aim for at least 80% attendance. Regular class participation significantly improves exam scores.
          </div>
        )}
      </div>

      {recentClasses.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h4 className="font-black text-slate-900 mb-4">📋 Recent Classes</h4>
          <div className="space-y-2">
            {recentClasses.map((c, i) => {
              const isPresent = c.attendance_status === 'present';
              const mins = c.duration_seconds ? Math.round(c.duration_seconds / 60) : 0;
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${isPresent ? 'bg-green-100' : 'bg-slate-100'}`}>
                    {isPresent ? '✅' : '⬜'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 truncate">{c.title}</div>
                    <div className="text-xs text-slate-400">
                      {c.scheduled_at ? new Date(c.scheduled_at.slice(0,10)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      {c.platform === 'zoom' ? ' · 🔵 Zoom' : ' · 🟢 Jitsi'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-bold ${isPresent ? 'text-green-600' : 'text-slate-400'}`}>
                      {isPresent ? `${mins}m` : 'Absent'}
                    </div>
                    {c.time_in_class_percent > 0 && (
                      <div className="text-[10px] text-slate-400">{Math.round(c.time_in_class_percent)}% time</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentClasses.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
          <div className="text-4xl mb-3">📺</div>
          <p className="font-bold text-slate-700 mb-1">No class history yet</p>
          <p className="text-sm text-slate-400">Join live classes to track your attendance here</p>
        </div>
      )}
    </div>
  );
}

// ─── TARGET SETUP FORM ────────────────────────────────────────
function TargetSetupForm({ existing, onSaved }) {
  const [form, setForm] = useState({
    exam_type: existing?.exam_type || 'IELTS',
    target_score: existing?.target_score || 7.0,
    target_date: existing?.target_date?.slice(0, 10) || '',
    study_hours_per_day: existing?.study_hours_per_day || 2,
    notes: existing?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const def = EXAMS[form.exam_type] || EXAMS.IELTS;
  const minDate = new Date(); minDate.setDate(minDate.getDate() + 7);

  const handleSave = async () => {
    if (!form.target_date) { setMsg('Please set your exam date'); return; }
    setSaving(true);
    try {
      await api.post('/student/targets', form);
      setMsg('✅ Target saved!');
      onSaved(form);
    } catch (e) { setMsg('❌ ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 max-w-lg">
      <h3 className="font-black text-slate-900 text-lg mb-1">🎯 Set Your Target</h3>
      <p className="text-sm text-slate-400 mb-5">Tell us your exam goal and we'll create a personalised study plan.</p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Exam Type</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(EXAMS).map(([key, ex]) => (
              <button key={key} onClick={() => setForm(f => ({ ...f, exam_type: key, target_score: ex.defaultTarget }))}
                className="flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-sm font-semibold transition"
                style={{ borderColor: form.exam_type === key ? ex.color : '#e2e8f0', background: form.exam_type === key ? ex.color + '10' : '#fff', color: form.exam_type === key ? ex.color : '#64748b' }}>
                <span>{ex.icon}</span>
                <span className="truncate text-xs">{ex.label.split(' (')[0]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Target {def.scoreLabel}</label>
            <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
              min={def.scoreMin} max={def.scoreMax} step={def.scoreStep}
              value={form.target_score} onChange={e => setForm(f => ({ ...f, target_score: parseFloat(e.target.value) || def.defaultTarget }))} />
            <p className="text-[10px] text-slate-400 mt-1">{def.scoreInfo.split('·')[0].trim()}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Study hrs/day</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.study_hours_per_day} onChange={e => setForm(f => ({ ...f, study_hours_per_day: parseFloat(e.target.value) }))}>
              {[0.5,1,1.5,2,2.5,3,4,5,6].map(h => <option key={h} value={h}>{h}h / day</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Target Exam Date</label>
          <input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            min={minDate.toISOString().slice(0, 10)} value={form.target_date}
            onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
          <input type="text" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="e.g. IELTS for Canada PR, need band 7 in all sections"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {msg && <p className={`text-sm font-semibold ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl font-black text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${def.color}, ${def.color}cc)` }}>
          {saving ? 'Saving...' : existing ? '✏️ Update Target' : '🎯 Set Target & Generate Plan'}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function StudentProgress({ initialTab = 'plan', accent = '#1e40af' }) {
  const [tab, setTab] = useState(initialTab);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTest, setActiveTest] = useState(null);
  const [editTarget, setEditTarget] = useState(false);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      const [prog, hist] = await Promise.all([
        api.get('/student/progress'),
        api.get('/student/tests/history'),
      ]);
      setProgress({ ...prog, testHistory: hist });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Loading your progress...</p>
      </div>
    </div>
  );

  // If in test — show full-screen test runner
  if (activeTest) {
    return (
      <div>
        <button onClick={() => setActiveTest(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-semibold mb-4 transition">
          ← Back to Tests
        </button>
        <TestRunner
          examType={activeTest.examType}
          moduleName={activeTest.moduleName}
          testType={activeTest.testType}
          questions={activeTest.questions}
          onComplete={() => { setActiveTest(null); loadProgress(); }}
        />
      </div>
    );
  }

  const TABS = [
    { id: 'plan', label: '🎯 Target Plan', shortLabel: 'Plan' },
    { id: 'performance', label: '📊 Performance', shortLabel: 'Scores' },
    { id: 'attendance', label: '📅 Attendance', shortLabel: 'Attend' },
    { id: 'tests', label: '📝 Module Tests', shortLabel: 'Tests' },
  ];

  const target = progress?.target;
  const examDef = target ? (EXAMS[target.exam_type] || EXAMS.IELTS) : null;
  const daysLeftNum = target ? daysLeft(target.target_date) : null;

  return (
    <div>
      {/* Header with target banner */}
      {target && !editTarget && (
        <div className="rounded-2xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3"
          style={{ background: `linear-gradient(135deg, ${examDef.color}15, ${examDef.color}08)`, border: `1.5px solid ${examDef.color}30` }}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{examDef.icon}</span>
            <div>
              <div className="font-black text-slate-900">{examDef.label}</div>
              <div className="text-sm text-slate-600">Target: <strong style={{ color: examDef.color }}>{target.target_score} {examDef.scoreLabel}</strong> · {target.target_date?.slice(0,10)}</div>
              {target.notes && <div className="text-xs text-slate-400 mt-0.5">{target.notes}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-black" style={{ color: daysLeftNum < 30 ? '#ef4444' : examDef.color }}>{daysLeftNum}</div>
              <div className="text-xs text-slate-400">days left</div>
            </div>
            <button onClick={() => setEditTarget(true)} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg transition">✏️ Edit</button>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setEditTarget(false); }}
            className="flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap"
            style={{ background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? accent : '#64748b', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Target Plan tab */}
      {tab === 'plan' && (
        <div>
          {(!target || editTarget) ? (
            <TargetSetupForm existing={target} onSaved={(saved) => { setEditTarget(false); loadProgress(); }} />
          ) : (
            <StudyPlan target={target} testScores={progress?.testScores || []} enrolledCourses={progress?.enrolledCourses || []} />
          )}
        </div>
      )}

      {/* Performance tab */}
      {tab === 'performance' && progress && (
        <PerformanceDashboard progress={progress} accent={accent} />
      )}

      {/* Attendance tab */}
      {tab === 'attendance' && progress && (
        <AttendanceView progress={progress} />
      )}

      {/* Tests tab */}
      {tab === 'tests' && (
        <ModuleTestsList
          examFilter={target?.exam_type}
          testHistory={progress?.testHistory || []}
          onStartTest={setActiveTest}
          accent={accent}
        />
      )}
    </div>
  );
}
