document.addEventListener('DOMContentLoaded', () => {
    // Language detection: Japanese for 'ja' browser language, English for all others
    function getBrowserLanguage() {
        try {
            const params = new URLSearchParams(window.location.search);
            const langParam = params.get('lang');
            if (langParam) {
                return langParam.toLowerCase().startsWith('ja') ? 'ja' : 'en';
            }
            const saved = localStorage.getItem('lang');
            if (saved === 'ja' || saved === 'en') {
                return saved;
            }
        } catch (e) {}

        const browserLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
        return browserLang.startsWith('ja') ? 'ja' : 'en';
    }

    let currentLang = getBrowserLanguage();
    document.documentElement.lang = currentLang;

    // Country detection: JP, US, GB (default to JP)
    function getInitialCountry() {
        try {
            const params = new URLSearchParams(window.location.search);
            const cParam = (params.get('country') || params.get('c') || '').toUpperCase();
            if (['JP', 'US', 'GB', 'UK'].includes(cParam)) {
                return cParam === 'UK' ? 'GB' : cParam;
            }
            const saved = (localStorage.getItem('country') || '').toUpperCase();
            if (['JP', 'US', 'GB'].includes(saved)) {
                return saved;
            }
        } catch (e) {}

        return 'JP';
    }

    let currentCountry = getInitialCountry();
    const countrySelect = document.getElementById('country');
    const yearSelect = document.getElementById('year');
    const todayYearBtn = document.getElementById('today-year-btn');
    const langToggleBtn = document.getElementById('lang-toggle');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const calendarTitle = document.getElementById('calendar-title');
    const calendarContainer = document.getElementById('calendar-container');
    const currentYear = new Date().getFullYear();
    let holidays = {};
    let maxCsvYear = 0;
    const estimatedHolidaysCache = {};

    // Function to convert Western year to Japanese era (Wareki)
    function toWareki(year, lang = currentLang) {
        if (lang === 'en') {
            if (year >= 2019) return `Reiwa ${year - 2018}`;
            if (year >= 1989) return `Heisei ${year - 1988}`;
            if (year >= 1926) return `Showa ${year - 1925}`;
            if (year >= 1912) return `Taisho ${year - 1911}`;
            if (year >= 1868) return `Meiji ${year - 1867}`;
            return '';
        }
        if (year >= 2019) return `令和${year - 2018}年`;
        if (year >= 1989) return `平成${year - 1988}年`;
        if (year >= 1926) return `昭和${year - 1925}年`;
        if (year >= 1912) return `大正${year - 1911}年`;
        if (year >= 1868) return `明治${year - 1867}年`;
        return '';
    }

    // Function to calculate Japanese sexagenary cycle (Eto) with emoji
    function getEto(year, lang = currentLang) {
        const jikkan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
        const junishi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
        const emojis = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐗'];
        const animalsEn = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Sheep', 'Monkey', 'Rooster', 'Dog', 'Boar'];

        const offset = year - 4;
        const jikkanIndex = ((offset % 10) + 10) % 10;
        const junishiIndex = ((offset % 12) + 12) % 12;

        if (lang === 'en') {
            return `Year of the ${animalsEn[junishiIndex]} (${emojis[junishiIndex]})`;
        }
        return `${jikkan[jikkanIndex]}${junishi[junishiIndex]} (${emojis[junishiIndex]})`;
    }

    // Update year info display in header
    function updateYearInfo(year) {
        const titleText = currentLang === 'en' ? `${year} Calendar` : `${year}年カレンダー`;
        if (calendarTitle) {
            calendarTitle.textContent = titleText;
        }
        document.title = titleText;
        const yearInfoEl = document.getElementById('year-info');
        if (!yearInfoEl) return;
        if (currentCountry === 'JP') {
            const wareki = toWareki(year, currentLang);
            const eto = getEto(year, currentLang);
            if (currentLang === 'en') {
                yearInfoEl.textContent = wareki ? `${wareki} · ${eto}` : eto;
            } else {
                yearInfoEl.textContent = wareki ? `${wareki} ${eto}` : eto;
            }
        } else {
            // Only display Wareki and Eto for Japanese calendar
            yearInfoEl.textContent = '';
        }
    }

    // Populate year selector
    for (let i = currentYear - 100; i <= currentYear + 100; i++) {
        const option = document.createElement('option');
        option.value = i;
        if (currentCountry === 'JP') {
            const wareki = toWareki(i, currentLang);
            option.textContent = wareki ? `${i} (${wareki})` : i;
        } else {
            option.textContent = `${i}`;
        }
        if (i === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }

    // Parse CSV data into holidays object
    function parseHolidays(csvText) {
        const lines = csvText.split(/\r?\n/);
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const commaIndex = line.indexOf(',');
            if (commaIndex === -1) continue;
            const dateStr = line.slice(0, commaIndex).trim();
            const holidayName = line.slice(commaIndex + 1).trim();

            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;
                holidays[formattedDate] = holidayName;
                if (year > maxCsvYear) {
                    maxCsvYear = year;
                }
            }
        }
    }

    // Spring equinox calculation formula (astronomical approximation)
    function getSpringEquinoxDay(year) {
        if (year <= 2099) {
            return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        }
        return Math.floor(21.8510 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }

    // Autumn equinox calculation formula (astronomical approximation)
    function getAutumnEquinoxDay(year) {
        if (year <= 2099) {
            return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        }
        return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }

    // Get date of N-th Monday of a given month
    function getNthMonday(year, month, n) {
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
        const firstMonday = 1 + (8 - firstDayOfWeek) % 7;
        return firstMonday + (n - 1) * 7;
    }

    // Estimate future Japanese holidays under current law
    function estimateHolidays(year) {
        const estimated = {};
        const pad = (n) => String(n).padStart(2, '0');

        function addHoliday(m, d, name) {
            estimated[`${year}-${pad(m)}-${pad(d)}`] = name;
        }

        // 1. Fixed and Happy Monday national holidays
        addHoliday(1, 1, '元日');
        addHoliday(1, getNthMonday(year, 1, 2), '成人の日');
        addHoliday(2, 11, '建国記念の日');
        addHoliday(2, 23, '天皇誕生日');
        addHoliday(3, getSpringEquinoxDay(year), '春分の日');
        addHoliday(4, 29, '昭和の日');
        addHoliday(5, 3, '憲法記念日');
        addHoliday(5, 4, 'みどりの日');
        addHoliday(5, 5, 'こどもの日');
        addHoliday(7, getNthMonday(year, 7, 3), '海の日');
        addHoliday(8, 11, '山の日');
        addHoliday(9, getNthMonday(year, 9, 3), '敬老の日');
        addHoliday(9, getAutumnEquinoxDay(year), '秋分の日');
        addHoliday(10, getNthMonday(year, 10, 2), 'スポーツの日');
        addHoliday(11, 3, '文化の日');
        addHoliday(11, 23, '勤労感謝の日');

        const baseKeys = new Set(Object.keys(estimated));

        // 2. 振替休日 (Substitute holidays: closest subsequent non-holiday day)
        for (const key of baseKeys) {
            const [y, m, d] = key.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            if (date.getDay() === 0) { // Sunday
                let nextDate = new Date(y, m - 1, d + 1);
                let nextKey = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
                while (baseKeys.has(nextKey)) {
                    nextDate.setDate(nextDate.getDate() + 1);
                    nextKey = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
                }
                estimated[nextKey] = '休日';
            }
        }

        // 3. 国民の休日 (Sandwiched weekdays between two national holidays)
        for (let m = 1; m <= 12; m++) {
            const daysInMonth = new Date(year, m, 0).getDate();
            for (let d = 2; d < daysInMonth; d++) {
                const currentKey = `${year}-${pad(m)}-${pad(d)}`;
                if (!estimated[currentKey]) {
                    const prevKey = `${year}-${pad(m)}-${pad(d - 1)}`;
                    const nextKey = `${year}-${pad(m)}-${pad(d + 1)}`;
                    if (baseKeys.has(prevKey) && baseKeys.has(nextKey)) {
                        const date = new Date(year, m - 1, d);
                        if (date.getDay() !== 0) { // Not Sunday
                            estimated[currentKey] = '休日';
                        }
                    }
                }
            }
        }

        return estimated;
    }

    // Helper to get n-th weekday of a month (nth: 1-5, dayOfWeek: 0-6)
    function getNthDayOfWeek(year, month, dayOfWeek, nth) {
        const firstDay = new Date(year, month - 1, 1).getDay();
        return 1 + ((dayOfWeek - firstDay + 7) % 7) + (nth - 1) * 7;
    }

    // Helper to get last weekday of a month
    function getLastDayOfWeek(year, month, dayOfWeek) {
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        const lastDayOfWeekOfMonth = new Date(year, month - 1, lastDayOfMonth).getDay();
        const diff = (lastDayOfWeekOfMonth - dayOfWeek + 7) % 7;
        return lastDayOfMonth - diff;
    }

    // Helper to compute Gregorian Easter
    function getEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return { month, day };
    }

    // Calculate US Federal Holidays
    function getUSHolidays(year) {
        const pad = (n) => String(n).padStart(2, '0');
        const holidaysMap = {};

        function add(m, d, nameEn, nameJa) {
            const key = `${year}-${pad(m)}-${pad(d)}`;
            holidaysMap[key] = { en: nameEn, ja: nameJa };
        }

        function addFixedWithObserved(m, d, nameEn, nameJa) {
            add(m, d, nameEn, nameJa);
            const date = new Date(year, m - 1, d);
            const dow = date.getDay();
            if (dow === 0) { // Sunday -> Monday observed
                add(m, d + 1, `${nameEn} (Observed)`, `${nameJa} (振替休日)`);
            } else if (dow === 6) { // Saturday -> Friday observed
                if (d > 1) {
                    add(m, d - 1, `${nameEn} (Observed)`, `${nameJa} (振替休日)`);
                }
            }
        }

        // New Year's Day
        addFixedWithObserved(1, 1, "New Year's Day", "元日");

        // Martin Luther King Jr. Day (3rd Mon of Jan, from 1986)
        if (year >= 1986) {
            add(1, getNthDayOfWeek(year, 1, 1, 3), "Martin Luther King Jr. Day", "マーティン・ルーサー・キング・ジュニア・デー");
        }

        // Washington's Birthday (3rd Mon of Feb)
        add(2, getNthDayOfWeek(year, 2, 1, 3), "Washington's Birthday", "ワシントン誕生日（大統領の日）");

        // Memorial Day (Last Mon of May)
        add(5, getLastDayOfWeek(year, 5, 1), "Memorial Day", "メモリアル・デー（戦没将兵追悼記念日）");

        // Juneteenth (Jun 19, from 2021)
        if (year >= 2021) {
            addFixedWithObserved(6, 19, "Juneteenth National Independence Day", "ジューンティーンス（全米独立記念日）");
        }

        // Independence Day (Jul 4)
        addFixedWithObserved(7, 4, "Independence Day", "独立記念日");

        // Labor Day (1st Mon of Sep)
        add(9, getNthDayOfWeek(year, 9, 1, 1), "Labor Day", "レイバー・デー（労働者の日）");

        // Columbus Day (2nd Mon of Oct)
        add(10, getNthDayOfWeek(year, 10, 1, 2), "Columbus Day", "コロンブス・デー");

        // Veterans Day (Nov 11)
        addFixedWithObserved(11, 11, "Veterans Day", "ベテランズ・デー（退役軍人の日）");

        // Thanksgiving Day (4th Thu of Nov)
        add(11, getNthDayOfWeek(year, 11, 4, 4), "Thanksgiving Day", "感謝祭（サンクスギビング）");

        // Christmas Day (Dec 25)
        addFixedWithObserved(12, 25, "Christmas Day", "クリスマス");

        return holidaysMap;
    }

    // Calculate UK (England and Wales) Bank Holidays
    function getUKHolidays(year) {
        const pad = (n) => String(n).padStart(2, '0');
        const holidaysMap = {};

        function add(m, d, nameEn, nameJa) {
            const key = `${year}-${pad(m)}-${pad(d)}`;
            holidaysMap[key] = { en: nameEn, ja: nameJa };
        }

        // New Year's Day
        const nyDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
        add(1, 1, "New Year's Day", "元日");
        if (nyDay === 6) {
            add(1, 3, "New Year's Day (Substitute day)", "元日 (振替休日)");
        } else if (nyDay === 0) {
            add(1, 2, "New Year's Day (Substitute day)", "元日 (振替休日)");
        }

        // Good Friday & Easter Monday
        const easter = getEaster(year);
        const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
        const goodFridayDate = new Date(easterDate.getTime() - 2 * 86400000);
        add(goodFridayDate.getUTCMonth() + 1, goodFridayDate.getUTCDate(), "Good Friday", "グッド・フライデー（聖金曜日）");

        const easterMondayDate = new Date(easterDate.getTime() + 1 * 86400000);
        add(easterMondayDate.getUTCMonth() + 1, easterMondayDate.getUTCDate(), "Easter Monday", "イースター・マンデー（復活祭の月曜日）");

        // Early May Bank Holiday (1st Mon of May)
        if (year === 2020) {
            add(5, 8, "Early May Bank Holiday (VE Day 75th Anniversary)", "アーリー・メイ・バンクホリデー（VEデー75周年）");
        } else if (year === 1995) {
            add(5, 8, "Early May Bank Holiday (VE Day 50th Anniversary)", "アーリー・メイ・バンクホリデー（VEデー50周年）");
        } else {
            add(5, getNthDayOfWeek(year, 5, 1, 1), "Early May Bank Holiday", "アーリー・メイ・バンクホリデー");
        }

        // Spring Bank Holiday (Last Mon of May)
        if (year === 2022) {
            add(6, 2, "Spring Bank Holiday", "スプリング・バンクホリデー");
            add(6, 3, "Platinum Jubilee Bank Holiday", "プラチナ・ジュビリー特別休日");
        } else if (year === 2012) {
            add(6, 4, "Spring Bank Holiday", "スプリング・バンクホリデー");
            add(6, 5, "Diamond Jubilee Bank Holiday", "ダイヤモンド・ジュビリー特別休日");
        } else {
            add(5, getLastDayOfWeek(year, 5, 1), "Spring Bank Holiday", "スプリング・バンクホリデー");
        }

        // Special Historical Bank Holidays
        if (year === 2023) {
            add(5, 8, "Bank Holiday for the Coronation of King Charles III", "チャールズ3世戴冠式特別休日");
        }
        if (year === 2022) {
            add(9, 19, "Bank Holiday for the State Funeral of Queen Elizabeth II", "エリザベス2世国葬特別休日");
        }
        if (year === 2011) {
            add(4, 29, "Royal Wedding Bank Holiday", "ロイヤル・ウェディング特別休日");
        }

        // Summer Bank Holiday (Last Mon of August)
        add(8, getLastDayOfWeek(year, 8, 1), "Summer Bank Holiday", "サマー・バンクホリデー");

        // Christmas Day & Boxing Day
        const cDay = new Date(Date.UTC(year, 11, 25)).getUTCDay();
        add(12, 25, "Christmas Day", "クリスマス・デー");
        add(12, 26, "Boxing Day", "ボクシング・デー");

        if (cDay === 5) {
            add(12, 28, "Boxing Day (Substitute day)", "ボクシング・デー (振替休日)");
        } else if (cDay === 6) {
            add(12, 27, "Christmas Day (Substitute day)", "クリスマス・デー (振替休日)");
            add(12, 28, "Boxing Day (Substitute day)", "ボクシング・デー (振替休日)");
        } else if (cDay === 0) {
            add(12, 27, "Christmas Day (Substitute day)", "クリスマス・デー (振替休日)");
        }

        return holidaysMap;
    }

    // Get holiday map for the requested year and country
    function getHolidaysForYear(year, country = currentCountry) {
        if (country === 'US') {
            return getUSHolidays(year);
        }
        if (country === 'GB') {
            return getUKHolidays(year);
        }
        // Default: Japan (JP)
        if (maxCsvYear > 0 && year > maxCsvYear) {
            if (!estimatedHolidaysCache[year]) {
                estimatedHolidaysCache[year] = estimateHolidays(year);
            }
            return estimatedHolidaysCache[year];
        }
        return holidays;
    }

    // English translations for Japanese national holidays
    const HOLIDAY_TRANSLATIONS_EN = {
        '元日': "New Year's Day",
        '成人の日': 'Coming of Age Day',
        '建国記念の日': 'National Foundation Day',
        '天皇誕生日': "Emperor's Birthday",
        '春分の日': 'Vernal Equinox Day',
        '昭和の日': 'Showa Day',
        '憲法記念日': 'Constitution Memorial Day',
        'みどりの日': 'Greenery Day',
        'こどもの日': "Children's Day",
        '海の日': 'Marine Day',
        '山の日': 'Mountain Day',
        '敬老の日': 'Respect for the Aged Day',
        '秋分の日': 'Autumnal Equinox Day',
        'スポーツの日': 'Sports Day',
        '体育の日': 'Health and Sports Day',
        '文化の日': 'Culture Day',
        '勤労感謝の日': 'Labor Thanksgiving Day',
        '振替休日': 'Substitute Holiday',
        '休日': 'Holiday',
        '国民の休日': "Citizen's Holiday",
        '即位礼正殿の儀': 'Enthronement Ceremony',
        '即位礼正殿の儀の行われる日': 'Enthronement Ceremony Day',
        '天皇の即位の日': "Emperor's Enthronement Day",
        '皇太子明仁親王の結婚の儀': 'Royal Wedding Day',
        '皇太子徳仁親王の結婚の儀': 'Royal Wedding Day',
        '昭和天皇の大喪の礼': 'Funeral of Emperor Showa'
    };

    function getHolidayDisplayName(name, lang = currentLang) {
        if (!name) return '';
        if (lang !== 'en') return name;
        if (HOLIDAY_TRANSLATIONS_EN[name]) return HOLIDAY_TRANSLATIONS_EN[name];
        if (name.includes('振替休日')) return 'Substitute Holiday';
        if (name.includes('休日')) return 'Holiday';
        return name;
    }

    // Update footer note for holidays
    function updateFooterNote(year) {
        const holidayNoteEl = document.getElementById('holiday-note');
        if (!holidayNoteEl) return;
        if (currentCountry === 'US') {
            holidayNoteEl.textContent = currentLang === 'en'
                ? '* Displaying U.S. Federal Holidays.'
                : '※ アメリカの連邦祝日（Federal Holidays）を表示しています。';
            holidayNoteEl.style.display = 'block';
        } else if (currentCountry === 'GB') {
            holidayNoteEl.textContent = currentLang === 'en'
                ? '* Displaying UK (England and Wales) Bank Holidays.'
                : '※ イギリス（イングランドおよびウェールズ）のバンクホリデーを表示しています。';
            holidayNoteEl.style.display = 'block';
        } else {
            // JP
            if (maxCsvYear > 0 && year > maxCsvYear) {
                holidayNoteEl.textContent = currentLang === 'en'
                    ? '* Holidays for this year are estimated based on the current National Holidays Act. Dates such as Equinoxes or legal amendments may change.'
                    : '※ この年の祝日は現行の「国民の祝日に関する法律」等に基づく推定値です。春分の日・秋分の日や法改正等により変更される場合があります。';
                holidayNoteEl.style.display = 'block';
            } else {
                holidayNoteEl.textContent = '';
                holidayNoteEl.style.display = 'none';
            }
        }
    }

    // Fetch Japanese holidays from syukujitsu_utf8.csv
    async function fetchHolidays() {
        try {
            const response = await fetch('syukujitsu_utf8.csv');
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const csvText = await response.text();
            parseHolidays(csvText);
        } catch (error) {
            console.error('Failed to fetch holidays:', error);
            // Display an error message to the user
            const errorMsg = currentLang === 'en'
                ? 'Failed to load holiday data. Please reload the page.'
                : '祝日データの読み込みに失敗しました。ページを再読み込みしてください。';
            calendarContainer.innerHTML = `<p style="color: var(--holiday-color); text-align: center;">${errorMsg}</p>`;
        }
    }

    // Constants for Moon phase calculation (synodic month)
    const LUNAR_MONTH = 29.530588853;
    const MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0); // 2000-01-06 18:14 UTC (Known New Moon)

    // Calculate moon phase and moon age for a given date (12:00 JST)
    function getMoonInfo(year, month, day, lang = currentLang) {
        const dateUtc = Date.UTC(year, month - 1, day, 3, 0, 0); // 12:00 JST = 03:00 UTC
        const diffDays = (dateUtc - MOON_EPOCH) / 86400000;
        let age = diffDays % LUNAR_MONTH;
        if (age < 0) age += LUNAR_MONTH;

        // 8 moon phases centered on the respective segments
        const phaseIndex = Math.floor(((age + (LUNAR_MONTH / 16)) % LUNAR_MONTH) / (LUNAR_MONTH / 8));

        const phasesJa = [
            { name: '新月（朔）', emoji: '🌑' },
            { name: '三日月', emoji: '🌒' },
            { name: '上弦の月', emoji: '🌓' },
            { name: '十三夜', emoji: '🌔' },
            { name: '満月（望）', emoji: '🌕' },
            { name: '十六夜', emoji: '🌖' },
            { name: '下弦の月', emoji: '🌗' },
            { name: '有明月', emoji: '🌘' }
        ];

        const phasesEn = [
            { name: 'New Moon', emoji: '🌑' },
            { name: 'Waxing Crescent', emoji: '🌒' },
            { name: 'First Quarter', emoji: '🌓' },
            { name: 'Waxing Gibbous', emoji: '🌔' },
            { name: 'Full Moon', emoji: '🌕' },
            { name: 'Waning Gibbous', emoji: '🌖' },
            { name: 'Last Quarter', emoji: '🌗' },
            { name: 'Waning Crescent', emoji: '🌘' }
        ];

        const p = (lang === 'en' ? phasesEn : phasesJa)[phaseIndex];
        const ageFormatted = age.toFixed(1);
        const ageText = lang === 'en' ? `Age ${ageFormatted}` : `月齢 ${ageFormatted}`;
        return {
            age: ageFormatted,
            name: p.name,
            emoji: p.emoji,
            text: `${p.emoji} ${p.name} (${ageText})`
        };
    }

    // Formatter for traditional lunisolar calendar (Kyureki)
    let lunarFormatter = null;
    try {
        lunarFormatter = new Intl.DateTimeFormat('ja-JP-u-ca-chinese', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    } catch (e) {
        lunarFormatter = null;
    }

    // Calculate Japanese traditional calendar (Kyureki) and Rokuyo
    function getKyurekiAndRokuyo(year, month, day, lang = currentLang) {
        if (!lunarFormatter) return null;
        try {
            const d = new Date(year, month - 1, day);
            const parts = lunarFormatter.formatToParts(d);
            let lunarMonthStr = '';
            let lunarDayStr = '';
            for (const part of parts) {
                if (part.type === 'month') lunarMonthStr = part.value;
                if (part.type === 'day') lunarDayStr = part.value;
            }
            if (!lunarMonthStr || !lunarDayStr) return null;

            const isLeap = lunarMonthStr.startsWith('閏');
            const monthNum = parseInt(lunarMonthStr.replace('閏', ''), 10);
            const dayNum = parseInt(lunarDayStr, 10);
            if (isNaN(monthNum) || isNaN(dayNum)) return null;

            const rokuyoListJa = ['大安', '赤口', '先勝', '友引', '先負', '仏滅'];
            const rokuyoListEn = ['Taian', 'Shakko', 'Sensho', 'Tomobiki', 'Senbu', 'Butsumetsu'];
            const rokuyo = (lang === 'en' ? rokuyoListEn : rokuyoListJa)[(monthNum + dayNum) % 6];

            let kyureki = '';
            if (lang === 'en') {
                kyureki = isLeap ? `Lunar: Leap ${monthNum}/${dayNum}` : `Lunar: ${monthNum}/${dayNum}`;
            } else {
                kyureki = `旧暦${lunarMonthStr}月${lunarDayStr}日`;
            }

            return { kyureki, rokuyo };
        } catch (e) {
            return null;
        }
    }

    let selectedDayCell = null;

    function deselectDay() {
        if (selectedDayCell) {
            selectedDayCell.classList.remove('selected', 'active');
            selectedDayCell = null;
        }
    }

    function selectDay(cell) {
        if (selectedDayCell === cell) {
            deselectDay();
            return;
        }
        if (selectedDayCell) {
            selectedDayCell.classList.remove('selected', 'active');
        }
        selectedDayCell = cell;
        cell.classList.add('selected', 'active');
    }

    // Generate the calendar for a given year
    function generateCalendar(year) {
        deselectDay();
        updateYearInfo(year);
        updateFooterNote(year);
        calendarContainer.innerHTML = ''; // Clear previous calendar
        const today = new Date();
        const yearHolidays = getHolidaysForYear(year, currentCountry);

        const monthNamesEn = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const daysOfWeekJa = ['日', '月', '火', '水', '木', '金', '土'];
        const daysOfWeekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const daysOfWeek = currentLang === 'en' ? daysOfWeekEn : daysOfWeekJa;

        for (let month = 0; month < 12; month++) {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-container';

            const monthHeader = document.createElement('h2');
            monthHeader.className = 'month-header';
            monthHeader.textContent = currentLang === 'en'
                ? `${monthNamesEn[month]} ${year}`
                : `${year}年 ${month + 1}月`;
            monthContainer.appendChild(monthHeader);

            const calendarGrid = document.createElement('div');
            calendarGrid.className = 'calendar-grid';

            // Day headers (Sun to Sat)
            daysOfWeek.forEach((day, index) => {
                const dayHeader = document.createElement('div');
                dayHeader.className = 'day-header';
                dayHeader.textContent = day;
                if (index === 0) dayHeader.classList.add('sunday');
                if (index === 6) dayHeader.classList.add('saturday');
                calendarGrid.appendChild(dayHeader);
            });

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)

            // Add empty cells for days before the 1st
            for (let i = 0; i < startDayOfWeek; i++) {
                const emptyCell = document.createElement('div');
                calendarGrid.appendChild(emptyCell);
            }

            // Add day cells
            for (let day = 1; day <= daysInMonth; day++) {
                const dayCell = document.createElement('div');
                dayCell.className = 'day';
                dayCell.textContent = day;

                const currentDate = new Date(year, month, day);
                const dayOfWeek = currentDate.getDay();

                if (dayOfWeek === 0) {
                    dayCell.classList.add('col-sun');
                } else if (dayOfWeek === 6) {
                    dayCell.classList.add('col-sat');
                }

                // Highlight today's date
                if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                    dayCell.classList.add('today');
                }
                
                // Format date as YYYY-MM-DD for holiday check
                const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                const rawHoliday = yearHolidays[formattedDate];
                let holidayName = '';
                if (rawHoliday) {
                    if (typeof rawHoliday === 'object') {
                        holidayName = currentLang === 'en' ? rawHoliday.en : rawHoliday.ja;
                    } else {
                        holidayName = getHolidayDisplayName(rawHoliday, currentLang);
                    }
                }
                const moon = getMoonInfo(year, month + 1, day, currentLang);
                const isJP = currentCountry === 'JP';
                const lunarInfo = isJP ? getKyurekiAndRokuyo(year, month + 1, day, currentLang) : null;

                dayCell.classList.add('tooltip');
                if (rawHoliday) {
                    dayCell.classList.add('holiday');
                    dayCell.setAttribute('data-holiday', holidayName);
                } else {
                    if (dayOfWeek === 0) {
                        dayCell.classList.add('sunday');
                    } else if (dayOfWeek === 6) {
                        dayCell.classList.add('saturday');
                    }
                }

                // Build tooltip text with Rokuyo, Kyureki, Moon phase & Holiday
                const lines = [];
                if (holidayName) {
                    if (lunarInfo) {
                        lines.push(currentLang === 'en'
                            ? `${holidayName} [${lunarInfo.rokuyo}]`
                            : `${holidayName} 【${lunarInfo.rokuyo}】`);
                        lines.push(`${lunarInfo.kyureki} ｜ ${moon.text}`);
                    } else {
                        lines.push(`${holidayName}`);
                        lines.push(`${moon.text}`);
                    }
                } else {
                    if (lunarInfo) {
                        lines.push(currentLang === 'en'
                            ? `[${lunarInfo.rokuyo}] ${lunarInfo.kyureki}`
                            : `【${lunarInfo.rokuyo}】 ${lunarInfo.kyureki}`);
                        lines.push(`${moon.text}`);
                    } else {
                        lines.push(`${moon.text}`);
                    }
                }

                const tooltipText = lines.join('\n');
                dayCell.setAttribute('data-tooltip', tooltipText);
                dayCell.setAttribute('title', tooltipText);

                // Click event for moon phase details
                dayCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectDay(dayCell);
                });
                
                calendarGrid.appendChild(dayCell);
            }

            monthContainer.appendChild(calendarGrid);
            calendarContainer.appendChild(monthContainer);
        }
    }

    // Ensure specified year exists in the select dropdown
    function ensureYearInSelect(year) {
        if (!yearSelect.querySelector(`option[value="${year}"]`)) {
            const option = document.createElement('option');
            option.value = year;
            if (currentCountry === 'JP') {
                const wareki = toWareki(year, currentLang);
                option.textContent = wareki ? `${year} (${wareki})` : year;
            } else {
                option.textContent = `${year}`;
            }

            const options = Array.from(yearSelect.options);
            const nextOption = options.find(opt => parseInt(opt.value, 10) > year);
            if (nextOption) {
                yearSelect.insertBefore(option, nextOption);
            } else {
                yearSelect.appendChild(option);
            }
        }
    }

    // Get year from URL query string (?year=YYYY or ?y=YYYY) or hash (#YYYY or #year=YYYY)
    function getYearFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const yearParam = params.get('year') || params.get('y');
            if (yearParam) {
                const y = parseInt(yearParam, 10);
                if (!isNaN(y)) return y;
            }

            const hash = window.location.hash.replace(/^#\/?/, '');
            if (hash) {
                if (hash.startsWith('year=')) {
                    const y = parseInt(hash.replace('year=', ''), 10);
                    if (!isNaN(y)) return y;
                }
                const y = parseInt(hash, 10);
                if (!isNaN(y)) return y;
            }
        } catch (e) {
            // ignore error
        }
        return null;
    }

    // Update URL with selected year, language, and country
    function updateUrl(year, pushHistory = true) {
        try {
            const url = new URL(window.location);
            url.searchParams.set('year', year);
            if (url.searchParams.has('lang') || currentLang !== getBrowserLanguage()) {
                url.searchParams.set('lang', currentLang);
            }
            if (url.searchParams.has('country') || currentCountry !== 'JP') {
                url.searchParams.set('country', currentCountry.toLowerCase());
            }
            if (url.hash) {
                url.hash = '';
            }
            if (pushHistory) {
                window.history.pushState({ year, lang: currentLang, country: currentCountry }, '', url.toString());
            } else {
                window.history.replaceState({ year, lang: currentLang, country: currentCountry }, '', url.toString());
            }
        } catch (e) {
            // ignore error in file:// protocol or restricted iframe
        }
    }

    // Navigate to a specific year
    function navigateToYear(year, pushHistory = true) {
        ensureYearInSelect(year);
        yearSelect.value = year;
        generateCalendar(year);
        updateUrl(year, pushHistory);
    }

    // Event listener for year change
    yearSelect.addEventListener('change', (e) => {
        const selectedYear = parseInt(e.target.value, 10);
        navigateToYear(selectedYear, true);
    });

    // Event listener for "今年" button
    if (todayYearBtn) {
        todayYearBtn.addEventListener('click', () => {
            const thisYear = new Date().getFullYear();
            navigateToYear(thisYear, true);
        });
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (e) => {
        if (e.state) {
            if (e.state.lang && e.state.lang !== currentLang) {
                currentLang = e.state.lang;
                updateLanguageUI();
            }
            if (e.state.country && e.state.country !== currentCountry) {
                currentCountry = e.state.country;
                if (countrySelect) countrySelect.value = currentCountry;
            }
        }
        const targetYear = getYearFromUrl() || currentYear;
        navigateToYear(targetYear, false);
    });

    // Handle hash change if user enters a hash URL
    window.addEventListener('hashchange', () => {
        const targetYear = getYearFromUrl() || currentYear;
        navigateToYear(targetYear, false);
    });

    // Theme handling (Light / Dark mode)
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggleBtn) {
            themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
            const label = currentLang === 'en'
                ? (theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode')
                : (theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
            themeToggleBtn.setAttribute('title', label);
            themeToggleBtn.setAttribute('aria-label', label);
        }
    }

    function initTheme() {
        let currentTheme = document.documentElement.getAttribute('data-theme');
        if (!currentTheme) {
            try {
                const saved = localStorage.getItem('theme');
                currentTheme = saved === 'light' ? 'light' : 'dark';
            } catch (e) {
                currentTheme = 'dark';
            }
        }
        applyTheme(currentTheme);

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'dark';
                const nextTheme = current === 'light' ? 'dark' : 'light';
                try {
                    localStorage.setItem('theme', nextTheme);
                } catch (e) {}
                applyTheme(nextTheme);
            });
        }
    }

    // Update all UI elements according to currentLang
    function updateLanguageUI() {
        document.documentElement.lang = currentLang;
        const countryLabel = document.getElementById('country-label');
        if (countryLabel) {
            countryLabel.textContent = currentLang === 'en' ? 'Country:' : '国:';
        }
        if (countrySelect) {
            const countryOptions = [
                { value: 'JP', ja: '🇯🇵 日本', en: '🇯🇵 Japan' },
                { value: 'US', ja: '🇺🇸 アメリカ', en: '🇺🇸 United States' },
                { value: 'GB', ja: '🇬🇧 イギリス', en: '🇬🇧 United Kingdom' }
            ];
            countrySelect.innerHTML = '';
            countryOptions.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = currentLang === 'en' ? opt.en : opt.ja;
                if (opt.value === currentCountry) {
                    el.selected = true;
                }
                countrySelect.appendChild(el);
            });
        }

        const yearLabel = document.getElementById('year-label');
        if (yearLabel) {
            yearLabel.textContent = currentLang === 'en' ? 'Select Year:' : '年を選択:';
        }
        if (todayYearBtn) {
            todayYearBtn.textContent = currentLang === 'en' ? 'This Year' : '今年';
        }
        if (langToggleBtn) {
            // Button label displays the target language to switch into
            langToggleBtn.textContent = currentLang === 'en' ? '日本語' : 'English';
            const label = currentLang === 'en' ? '日本語表示に切り替え' : 'Switch to English';
            langToggleBtn.setAttribute('title', label);
            langToggleBtn.setAttribute('aria-label', label);
        }

        // Update all options in year selector dropdown
        updateYearSelectOptions();

        // Update theme toggle tooltips
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        applyTheme(currentTheme);
    }

    // Update all options in year selector dropdown according to country and language
    function updateYearSelectOptions() {
        const currentSelectedVal = parseInt(yearSelect.value, 10) || currentYear;
        Array.from(yearSelect.options).forEach(opt => {
            const y = parseInt(opt.value, 10);
            if (currentCountry === 'JP') {
                const wareki = toWareki(y, currentLang);
                opt.textContent = wareki ? `${y} (${wareki})` : y;
            } else {
                opt.textContent = `${y}`;
            }
        });
        yearSelect.value = currentSelectedVal;
    }

    // Set country manually and persist
    function setCountry(newCountry, updateUrlParam = true) {
        currentCountry = newCountry;
        try {
            localStorage.setItem('country', newCountry);
        } catch (e) {}

        if (countrySelect) {
            countrySelect.value = newCountry;
        }

        updateYearSelectOptions();

        const selectedYear = parseInt(yearSelect.value, 10) || currentYear;
        updateYearInfo(selectedYear);
        updateFooterNote(selectedYear);
        generateCalendar(selectedYear);

        if (updateUrlParam) {
            updateUrl(selectedYear, false);
        }
    }

    // Event listener for country change
    if (countrySelect) {
        countrySelect.addEventListener('change', (e) => {
            setCountry(e.target.value, true);
        });
    }

    // Set language manually and persist
    function setLanguage(newLang, updateUrlParam = true) {
        currentLang = newLang;
        try {
            localStorage.setItem('lang', newLang);
        } catch (e) {}

        updateLanguageUI();

        const selectedYear = parseInt(yearSelect.value, 10) || currentYear;
        generateCalendar(selectedYear);

        if (updateUrlParam) {
            updateUrl(selectedYear, false);
        }
    }

    // Event listener for manual language toggle
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            const nextLang = currentLang === 'en' ? 'ja' : 'en';
            setLanguage(nextLang, true);
        });
    }

    // Initial load
    async function init() {
        updateLanguageUI();
        if (countrySelect) {
            countrySelect.value = currentCountry;
        }
        initTheme();
        await fetchHolidays();
        const initialYear = getYearFromUrl() || currentYear;
        ensureYearInSelect(initialYear);
        yearSelect.value = initialYear;
        generateCalendar(initialYear);
    }

    // Click outside to deselect day
    document.addEventListener('click', () => {
        deselectDay();
    });

    init();
});
