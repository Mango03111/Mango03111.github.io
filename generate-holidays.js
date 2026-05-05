const fs = require('fs');
const path = require('path');
const { Solar, HolidayUtil } = require('lunar-javascript');

const holidayMessages = {
    // 自定义纪念日
    '01-28': { name: '站长生日', msgs: ['祝站长 Mango 生日快乐！', '岁岁常欢愉，年年皆胜意。站长破壳日快乐！'] },
    '01-01': { name: '博客生日', msgs: ['本博客又长大了一岁！', '代码与时光同在，见证每一次提交与成长。'] },
    
    // 法定/传统/国际节日
    '春节': { msgs: ['新春大吉，万事如意！', '辞旧迎新，愿新年胜旧年。'] },
    '元旦': { msgs: ['一元复始，万象更新。', '新年好，愿新的一年闪闪发光。'] },
    '清明节': { msgs: ['慎终追远，缅怀先辈。', '燕子来时新社，梨花落后清明。'] },
    '劳动节': { msgs: ['致敬每一位努力奋斗的劳动者。', '劳动最光荣！'] },
    '端午节': { msgs: ['端午安康，百病不侵。', '粽叶飘香，又是一年端阳。'] },
    '中秋节': { msgs: ['海上生明月，天涯共此时。', '中秋佳节，阖家团圆。'] },
    '国庆节': { msgs: ['祝福祖国母亲生日快乐！', '繁荣昌盛，国泰民安。'] },
    '七夕节': { msgs: ['星河璀璨，七夕佳节。', '愿得一人心，白首不相离。'] },
    '感恩节': { msgs: ['心怀感恩，皆是美好。', '感谢生命中所有的相遇与陪伴。'] },
    '妇女节': { msgs: ['祝所有女性力量熠熠生辉。', '节日快乐，做最闪亮的自己。'] },
    '青年节': { msgs: ['青春逢盛世，奋斗正当时。', '五四精神，薪火相传。'] },
    '儿童节': { msgs: ['永葆童心，快乐无界。', '愿你历尽千帆，归来仍是少年。'] },
    '建党节': { msgs: ['不忘初心，牢记使命。', '星火燎原，辉煌历程。'] },
    '建军节': { msgs: ['致敬最可爱的人！', '岁月静好，因有人负重前行。'] },
    '教师节': { msgs: ['桃李满天下，春晖遍四方。', '师恩难忘，节日快乐。'] },

    // 二十四节气
    '立春': { msgs: ['今日立春，万物生机萌发。', '东风解冻，春日初临。'] },
    '雨水': { msgs: ['今日雨水，润物细无声。', '好雨知时节，当春乃发生。'] },
    '惊蛰': { msgs: ['今日惊蛰，春雷乍动，万物生机盎然。'] },
    '春分': { msgs: ['今日春分，昼夜均而寒暑平。', '草长莺飞，春意正浓。'] },
    '谷雨': { msgs: ['今日谷雨，雨生百谷，春将尽。', '落花游丝白日静，鸣鸠春半雨建瓴。'] },
    '立夏': { msgs: ['今日立夏，万物至此皆长大。', '南风草木香，初夏悠悠长。'] },
    '小满': { msgs: ['今日小满，物至于此小得盈满。', '人生最好是小满。'] },
    '芒种': { msgs: ['今日芒种，连收带种，辛勤耕耘。'] },
    '夏至': { msgs: ['今日夏至，白昼最长，骄阳似火。'] },
    '小暑': { msgs: ['今日小暑，倏忽温风至，因循小暑来。'] },
    '大暑': { msgs: ['今日大暑，万物荣华，烈日炎炎。'] },
    '立秋': { msgs: ['今日立秋，云天收夏色，木叶动秋声。'] },
    '处暑': { msgs: ['今日处暑，暑气至此而止矣。'] },
    '白露': { msgs: ['今日白露，露从今夜白，月是故乡明。'] },
    '秋分': { msgs: ['今日秋分，秋意浓，昼夜平。'] },
    '寒露': { msgs: ['今日寒露，袅袅凉风动，凄凄寒露零。'] },
    '霜降': { msgs: ['今日霜降，气肃而凝，露结为霜矣。'] },
    '立冬': { msgs: ['今日立冬，秋去冬来，万物收藏。'] },
    '小雪': { msgs: ['今日小雪，晚来天欲雪，能饮一杯无？'] },
    '大雪': { msgs: ['今日大雪，至此而雪盛也。'] },
    '冬至': { msgs: ['今日冬至，阴极之至，阳气始生。'] },
    '小寒': { msgs: ['今日小寒，冷气积久而寒。'] },
    '大寒': { msgs: ['今日大寒，岁末清寒，春之将至。'] }
};

const blackList = [
    '消费者权益日', '龙头节', '全国中小学生安全教育日', '愚人节', 
    '全国助残日', '全民国防教育日', '世界住房日', 
    '情人节', '万圣节', '圣诞节', '平安夜', '复活节'
];


const normalizeName = (name) => {
    if (name === '元旦节') return '元旦';
    if (name === '清明') return '清明节'; // 将节气清明与节日合并
    return name;
};

const year = new Date().getFullYear();
const holidaysData = {};

for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        const dateStrMMDD = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        let dailyEvents = [];
        let festivalsSet = new Set();
        let baseFestivals = [
            ...solar.getFestivals(), 
            ...lunar.getFestivals(),
            lunar.getJieQi()
        ].filter(Boolean);
        baseFestivals.forEach(f => festivalsSet.add(normalizeName(f)));

        const statutory = HolidayUtil.getHoliday(year, month, day);
        if (statutory && !statutory.isWork()) {
            festivalsSet.add(normalizeName(statutory.getName()));
        }

        // 过滤黑名单
        let filteredFestivals = Array.from(festivalsSet).filter(f => !blackList.some(b => f.includes(b)));

        // 组装最终 JSON 数据
        filteredFestivals.forEach(festName => {
            dailyEvents.push({
                name: festName,
                msgs: holidayMessages[festName]?.msgs || [`今日${festName}，愿你度过美好的一天。`]
            });
        });

        // 插入自定义纪念日
        if (holidayMessages[dateStrMMDD]) {
            const customExists = dailyEvents.some(e => e.name === holidayMessages[dateStrMMDD].name);
            if (!customExists) {
                dailyEvents.push({
                    name: holidayMessages[dateStrMMDD].name,
                    msgs: holidayMessages[dateStrMMDD].msgs
                });
            }
        }

        if (dailyEvents.length > 0) {
            holidaysData[dateStrMMDD] = dailyEvents;
        }
    }
}

const outputPath = path.join(__dirname, 'source', 'holidays.json');
fs.writeFileSync(outputPath, JSON.stringify(holidaysData, null, 2), 'utf-8');
console.log(`成功生成 ${year} 年度节日数据`);
