(function () {
  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function startOfWeek(d) {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const date = startOfDay(d);
    date.setDate(date.getDate() - diff);
    return date;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function startOfYear(d) {
    return new Date(d.getFullYear(), 0, 1);
  }

  function daysInMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function percent(value, total) {
    if (!total) return 0;
    return clamp((value / total) * 100, 0, 100);
  }

  function setItem(root, key, value, pct) {
    const unitEl = root.querySelector(`[data-life-unit="${key}"]`);
    const fillEl = root.querySelector(`[data-life-fill="${key}"]`);
    const percentEl = root.querySelector(`[data-life-percent="${key}"]`);
    if (unitEl) unitEl.textContent = value;
    if (fillEl) fillEl.style.width = `${pct.toFixed(1)}%`;
    if (percentEl) percentEl.textContent = `${Math.round(pct)}%`;
  }

  function initLifeCounter() {
    document.querySelectorAll('[data-life-counter]').forEach((root) => {
      const now = new Date();

      const dayElapsedHours = (now - startOfDay(now)) / 36e5;
      const dayPct = percent(dayElapsedHours, 24);

      const weekElapsedDays = (now - startOfWeek(now)) / 864e5;
      const weekPct = percent(weekElapsedDays, 7);

      const monthElapsedDays = (now - startOfMonth(now)) / 864e5;
      const monthPct = percent(monthElapsedDays, daysInMonth(now));

      const yearElapsedMonths = now.getMonth() + now.getDate() / daysInMonth(now);
      const yearPct = percent(yearElapsedMonths, 12);

      setItem(root, 'today', Math.floor(dayElapsedHours), dayPct);
      setItem(root, 'week', Math.floor(weekElapsedDays), weekPct);
      setItem(root, 'month', Math.floor(monthElapsedDays), monthPct);
      setItem(root, 'year', Math.floor(yearElapsedMonths), yearPct);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLifeCounter);
  } else {
    initLifeCounter();
  }
  document.addEventListener('pjax:complete', initLifeCounter);
})();
