(function () {
    const initHolidayPopup = async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        
        const todayStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const todayFullStr = `${year}-${todayStr}`;

        const displayDate = `今天是 ${year}年${month}月${day}日`;

        const storageKey = `holiday_popup_seen_${todayFullStr}`;
        if (localStorage.getItem(storageKey)) return;

        try {
            const response = await fetch('/holidays.json');
            if (!response.ok) return;
            const holidaysData = await response.json();

            const todaysHolidays = holidaysData[todayStr];
            if (!todaysHolidays || todaysHolidays.length === 0) return;

            renderPopup(todaysHolidays, displayDate, storageKey);
        } catch (error) {
            console.error('节假日数据加载失败:', error);
        }
    };

    const getEmoji = (name) => {
        const emojiMap = {
            '春节': '🏮', '元旦': '🎉', '清明节': '🌿', '劳动节': '🛠️',
            '端午节': '🐉', '中秋节': '🥮', '国庆节': '🇨🇳',
            '站长生日': '🎂', '博客生日': '💻',
            '七夕节': '💖', '感恩节': '🦃', '妇女节': '🌹',
            '青年节': '🔥', '儿童节': '🎈', '建党节': '🚩',
            '建军节': '🎖️', '教师节': '💐',
            '立春': '🌱', '雨水': '💧', '惊蛰': '⚡', '春分': '🌸',
            '谷雨': '🌧️', '立夏': '🍉', '小满': '🌾', '芒种': '🌻',
            '夏至': '☀️', '小暑': '🍧', '大暑': '🔥', '立秋': '🍂',
            '处暑': '🍁', '白露': '🍵', '秋分': '🌾', '寒露': '🍁',
            '霜降': '❄️', '立冬': '⛄', '小雪': '🌨️', '大雪': '❄️',
            '冬至': '🥟', '小寒': '🧣', '大寒': '🧤'
        };
        return emojiMap[name] || '✨';
    };

    const renderPopup = (holidays, displayDate, storageKey) => {
        if (document.getElementById('holiday-popup-wrapper')) return;

        const style = document.createElement('style');
        style.id = 'holiday-popup-style';
        style.textContent = `
            #holiday-popup-wrapper {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.5); 
                z-index: 999999;
                display: flex; justify-content: center; align-items: center;
            }
            #holiday-popup-box {
                position: relative; width: 85%; max-width: 380px;
                padding: 30px 25px; border-radius: 10px; text-align: center;
                background: rgba(255, 255, 255, 0.85); 
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                border: 1px solid rgba(255, 255, 255, 0.85);
                box-shadow: 0 8px 16px -4px rgba(138, 138, 138, 0.15);
                display: flex; flex-direction: column; align-items: center;
                transition: background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease;
            }
            html[data-theme="dark"] #holiday-popup-box {
                background: rgba(30, 30, 30, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.2);
            }
            #holiday-popup-date { 
                font-size: 14px; margin-bottom: 22px; font-weight: 500;
                color: var(--font-color); opacity: 0.85; 
            }
            .holiday-item { margin-bottom: 22px; }
            .holiday-item:last-of-type { margin-bottom: 10px; }
            .holiday-title {
                font-size: 20px; font-weight: bold; margin: 0 0 12px 0;
                color: #49b1f5; display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .holiday-msg { 
                font-size: 15px; line-height: 1.6; margin: 0; 
                color: var(--font-color);
            }
            #holiday-popup-close-btn {
                margin-top: 20px; padding: 8px 32px;
                font-size: 14px; cursor: pointer; border-radius: 5px;
                border: 1px solid #49b1f5; background: transparent; color: #49b1f5;
                transition: all 0.3s;
            }
            #holiday-popup-close-btn:hover { background: #49b1f5; color: #fff; }
        `;
        document.head.appendChild(style);

        const itemsHtml = holidays.map(holiday => {
            const randomMsg = holiday.msgs[Math.floor(Math.random() * holiday.msgs.length)];
            const emoji = getEmoji(holiday.name);
            return `
                <div class="holiday-item">
                    <h3 class="holiday-title"><span>${emoji}</span> ${holiday.name}</h3>
                    <p class="holiday-msg">${randomMsg}</p>
                </div>
            `;
        }).join('');

        const isBirthday = holidays.some(holiday => 
            holiday.name === '站长生日' || holiday.name === '博客生日'
        );
        const closeBtnText = isBirthday ? '生日快乐！' : '关闭';

        const wrapper = document.createElement('div');
        wrapper.id = 'holiday-popup-wrapper';
        wrapper.innerHTML = `
            <div id="holiday-popup-box">
                <div id="holiday-popup-date">${displayDate}</div>
                ${itemsHtml}
                <button id="holiday-popup-close-btn">${closeBtnText}</button>
            </div>
        `;
        document.body.appendChild(wrapper);

        document.getElementById('holiday-popup-close-btn').addEventListener('click', () => {
            wrapper.remove();
            style.remove();
            localStorage.setItem(storageKey, 'true');
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHolidayPopup);
    } else {
        initHolidayPopup();
    }
    document.addEventListener('pjax:complete', initHolidayPopup);
})();
