document.addEventListener('DOMContentLoaded', () => {
    const yearSelect = document.getElementById('year');
    const todayYearBtn = document.getElementById('today-year-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const calendarContainer = document.getElementById('calendar-container');
    const currentYear = new Date().getFullYear();
    let holidays = {};
    let maxCsvYear = 0;
    const estimatedHolidaysCache = {};

    // Function to convert Western year to Japanese era (Wareki)
    function toWareki(year) {
        if (year >= 2019) return `令和${year - 2018}年`;
        if (year >= 1989) return `平成${year - 1988}年`;
        if (year >= 1926) return `昭和${year - 1925}年`;
        if (year >= 1912) return `大正${year - 1911}年`;
        if (year >= 1868) return `明治${year - 1867}年`;
        return '';
    }

    // Function to calculate Japanese sexagenary cycle (Eto) with emoji
    function getEto(year) {
        const jikkan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
        const junishi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
        const emojis = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐗'];

        const offset = year - 4;
        const jikkanIndex = ((offset % 10) + 10) % 10;
        const junishiIndex = ((offset % 12) + 12) % 12;

        return `${jikkan[jikkanIndex]}${junishi[junishiIndex]} (${emojis[junishiIndex]})`;
    }

    // Update year info display in header
    function updateYearInfo(year) {
        const yearInfoEl = document.getElementById('year-info');
        if (!yearInfoEl) return;
        const wareki = toWareki(year);
        const eto = getEto(year);
        yearInfoEl.textContent = wareki ? `${wareki} ${eto}` : eto;
    }

    // Populate year selector
    for (let i = currentYear - 100; i <= currentYear + 100; i++) {
        const option = document.createElement('option');
        option.value = i;
        const wareki = toWareki(i);
        option.textContent = wareki ? `${i} (${wareki})` : i;
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

    // Get holiday map for the requested year (from CSV or estimated)
    function getHolidaysForYear(year) {
        if (maxCsvYear > 0 && year > maxCsvYear) {
            if (!estimatedHolidaysCache[year]) {
                estimatedHolidaysCache[year] = estimateHolidays(year);
            }
            return estimatedHolidaysCache[year];
        }
        return holidays;
    }

    // Update footer note for estimated holidays
    function updateFooterNote(year) {
        const holidayNoteEl = document.getElementById('holiday-note');
        if (!holidayNoteEl) return;
        if (maxCsvYear > 0 && year > maxCsvYear) {
            holidayNoteEl.textContent = '※ この年の祝日は現行の「国民の祝日に関する法律」等に基づく推定値です。春分の日・秋分の日や法改正等により変更される場合があります。';
            holidayNoteEl.style.display = 'block';
        } else {
            holidayNoteEl.textContent = '';
            holidayNoteEl.style.display = 'none';
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
            calendarContainer.innerHTML = '<p style="color: var(--holiday-color); text-align: center;">祝日データの読み込みに失敗しました。ページを再読み込みしてください。</p>';
        }
    }

    // Generate the calendar for a given year
    function generateCalendar(year) {
        updateYearInfo(year);
        updateFooterNote(year);
        calendarContainer.innerHTML = ''; // Clear previous calendar
        const today = new Date();
        const yearHolidays = getHolidaysForYear(year);

        for (let month = 0; month < 12; month++) {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-container';

            const monthHeader = document.createElement('h2');
            monthHeader.className = 'month-header';
            monthHeader.textContent = `${year}年 ${month + 1}月`;
            monthContainer.appendChild(monthHeader);

            const calendarGrid = document.createElement('div');
            calendarGrid.className = 'calendar-grid';

            // Day headers (Sun to Sat)
            const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
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

                // Highlight today's date
                if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                    dayCell.classList.add('today');
                }
                
                // Format date as YYYY-MM-DD for holiday check
                const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                const holidayName = yearHolidays[formattedDate];
                if (holidayName) {
                    dayCell.classList.add('holiday');
                    dayCell.classList.add('tooltip');
                    dayCell.setAttribute('data-holiday', holidayName);
                } else if (dayOfWeek === 0) { // Sunday
                    dayCell.classList.add('sunday');
                } else if (dayOfWeek === 6) { // Saturday
                    dayCell.classList.add('saturday');
                }
                
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
            const wareki = toWareki(year);
            option.textContent = wareki ? `${year} (${wareki})` : year;

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

    // Update URL with selected year
    function updateUrl(year, pushHistory = true) {
        try {
            const url = new URL(window.location);
            url.searchParams.set('year', year);
            if (url.hash) {
                url.hash = '';
            }
            if (pushHistory) {
                window.history.pushState({ year }, '', url.toString());
            } else {
                window.history.replaceState({ year }, '', url.toString());
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
    window.addEventListener('popstate', () => {
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
            const label = theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え';
            themeToggleBtn.setAttribute('title', label);
            themeToggleBtn.setAttribute('aria-label', label);
        }
    }

    function initTheme() {
        let currentTheme = document.documentElement.getAttribute('data-theme');
        if (!currentTheme) {
            try {
                const saved = localStorage.getItem('theme');
                const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
                currentTheme = saved || (prefersLight ? 'light' : 'dark');
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

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
                try {
                    if (!localStorage.getItem('theme')) {
                        applyTheme(e.matches ? 'light' : 'dark');
                    }
                } catch (err) {}
            });
        }
    }

    // Initial load
    async function init() {
        initTheme();
        await fetchHolidays();
        const initialYear = getYearFromUrl() || currentYear;
        ensureYearInSelect(initialYear);
        yearSelect.value = initialYear;
        generateCalendar(initialYear);
    }

    init();
});
