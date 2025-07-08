document.addEventListener('DOMContentLoaded', () => {
    const yearSelect = document.getElementById('year');
    const calendarContainer = document.getElementById('calendar-container');
    const currentYear = new Date().getFullYear();
    let holidays = {};

    // Populate year selector
    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }

    // Fetch Japanese holidays
    async function fetchHolidays() {
        try {
            const response = await fetch('https://holidays-jp.github.io/api/v1/date.json');
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            holidays = await response.json();
        } catch (error) {
            console.error('Failed to fetch holidays:', error);
            // Display an error message to the user
            calendarContainer.innerHTML = '<p style="color: var(--holiday-color); text-align: center;">祝日データの読���込みに失敗しました。ページを再読み込みしてください。</p>';
        }
    }

    // Generate the calendar for a given year
    function generateCalendar(year) {
        calendarContainer.innerHTML = ''; // Clear previous calendar

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
                
                // Format date as YYYY-MM-DD for holiday check
                const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                const holidayName = holidays[formattedDate];
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

    // Event listener for year change
    yearSelect.addEventListener('change', (e) => {
        const selectedYear = parseInt(e.target.value, 10);
        generateCalendar(selectedYear);
    });

    // Initial load
    async function init() {
        await fetchHolidays();
        generateCalendar(currentYear);
    }

    init();
});
