(() => {
  'use strict'

  const gridSelector = '.album-waterfall'
  const activeObservers = new Set()
  const lightbox = {
    activeIndex: 0,
    lastTrigger: null,
    triggers: []
  }
  let resizeTimer = null

  const ensureLightbox = () => {
    let root = document.getElementById('album-lightbox')
    if (root) return root

    root = document.createElement('div')
    root.id = 'album-lightbox'
    root.className = 'album-lightbox'
    root.hidden = true
    root.setAttribute('aria-hidden', 'true')
    root.innerHTML = `
      <div class="album-lightbox-backdrop" data-album-lightbox-close></div>
      <div class="album-lightbox-dialog" role="dialog" aria-modal="true" aria-label="相册图片预览">
        <button class="album-lightbox-close" type="button" data-album-lightbox-close aria-label="关闭图片预览">&times;</button>
        <button class="album-lightbox-nav album-lightbox-prev" type="button" data-album-lightbox-prev aria-label="查看上一张图片">&#10094;</button>
        <figure class="album-lightbox-figure">
          <img class="album-lightbox-image" alt="">
          <figcaption class="album-lightbox-meta">
            <span class="album-lightbox-caption"></span>
            <span class="album-lightbox-counter" aria-live="polite"></span>
          </figcaption>
        </figure>
        <button class="album-lightbox-nav album-lightbox-next" type="button" data-album-lightbox-next aria-label="查看下一张图片">&#10095;</button>
      </div>`

    document.body.appendChild(root)
    return root
  }

  const updateLightbox = index => {
    const root = ensureLightbox()
    const total = lightbox.triggers.length
    if (!total) return

    lightbox.activeIndex = (index + total) % total
    const trigger = lightbox.triggers[lightbox.activeIndex]
    const thumbnail = trigger.querySelector('img')
    const src = trigger.dataset.src || ''
    const caption = trigger.dataset.caption || thumbnail?.alt || ''
    const image = root.querySelector('.album-lightbox-image')
    const navigation = root.querySelectorAll('.album-lightbox-nav')

    image.src = src
    image.alt = thumbnail?.alt || caption
    root.querySelector('.album-lightbox-caption').textContent = caption
    root.querySelector('.album-lightbox-counter').textContent = `${lightbox.activeIndex + 1} / ${total}`
    navigation.forEach(button => { button.hidden = total < 2 })

    const nextTrigger = lightbox.triggers[(lightbox.activeIndex + 1) % total]
    if (total > 1 && nextTrigger?.dataset.src) {
      const preload = new Image()
      preload.src = nextTrigger.dataset.src
    }
  }

  const openLightbox = trigger => {
    const group = trigger.dataset.albumGroup
    lightbox.triggers = [...document.querySelectorAll('.album-photo-trigger')]
      .filter(item => item.dataset.albumGroup === group)
    lightbox.lastTrigger = trigger

    const root = ensureLightbox()
    root.hidden = false
    root.setAttribute('aria-hidden', 'false')
    document.body.classList.add('album-lightbox-open')
    updateLightbox(lightbox.triggers.indexOf(trigger))
    root.querySelector('.album-lightbox-close').focus()
  }

  const closeLightbox = () => {
    const root = document.getElementById('album-lightbox')
    if (!root || root.hidden) return

    root.hidden = true
    root.setAttribute('aria-hidden', 'true')
    root.querySelector('.album-lightbox-image').removeAttribute('src')
    document.body.classList.remove('album-lightbox-open')

    if (lightbox.lastTrigger?.isConnected) lightbox.lastTrigger.focus()
    lightbox.triggers = []
    lightbox.lastTrigger = null
  }

  const resizeItem = item => {
    const grid = item.closest(gridSelector)
    if (!grid) return

    const styles = window.getComputedStyle(grid)
    const rowHeight = Number.parseFloat(styles.gridAutoRows)
    const rowGap = Number.parseFloat(styles.rowGap) || 0
    if (!rowHeight) return

    item.style.gridRowEnd = 'span 1'
    const itemHeight = item.getBoundingClientRect().height
    const rowSpan = Math.max(1, Math.ceil((itemHeight + rowGap) / (rowHeight + rowGap)))
    item.style.gridRowEnd = `span ${rowSpan}`
  }

  const resizeGrid = grid => {
    grid.querySelectorAll('.album-photo').forEach(resizeItem)
  }

  const bindImage = image => {
    if (image.dataset.albumWaterfallBound === 'true') return

    image.dataset.albumWaterfallBound = 'true'
    image.addEventListener('load', () => {
      window.requestAnimationFrame(() => resizeItem(image.closest('.album-photo')))
    })
  }

  const initGrid = grid => {
    if (grid.dataset.albumWaterfallReady === 'true') {
      resizeGrid(grid)
      return
    }

    grid.dataset.albumWaterfallReady = 'true'
    grid.querySelectorAll('img').forEach(bindImage)
    window.requestAnimationFrame(() => resizeGrid(grid))

    if ('ResizeObserver' in window) {
      let previousWidth = 0
      const observer = new ResizeObserver(entries => {
        const currentWidth = entries[0]?.contentRect.width || 0
        if (Math.abs(currentWidth - previousWidth) < 1) return

        previousWidth = currentWidth
        window.requestAnimationFrame(() => resizeGrid(grid))
      })

      observer.observe(grid)
      activeObservers.add(observer)
    }
  }

  const init = () => {
    document.querySelectorAll(gridSelector).forEach(initGrid)
  }

  const disconnectObservers = () => {
    activeObservers.forEach(observer => observer.disconnect())
    activeObservers.clear()
  }

  const handleResize = () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(init, 120)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }

  window.addEventListener('resize', handleResize)
  document.addEventListener('click', event => {
    const trigger = event.target.closest('.album-photo-trigger')
    if (trigger) {
      openLightbox(trigger)
      return
    }

    if (event.target.closest('[data-album-lightbox-close]')) closeLightbox()
    if (event.target.closest('[data-album-lightbox-prev]')) updateLightbox(lightbox.activeIndex - 1)
    if (event.target.closest('[data-album-lightbox-next]')) updateLightbox(lightbox.activeIndex + 1)
  })
  document.addEventListener('keydown', event => {
    const root = document.getElementById('album-lightbox')
    if (!root || root.hidden) return

    if (event.key === 'Escape') closeLightbox()
    if (event.key === 'ArrowLeft') updateLightbox(lightbox.activeIndex - 1)
    if (event.key === 'ArrowRight') updateLightbox(lightbox.activeIndex + 1)
  })
  document.addEventListener('pjax:send', () => {
    closeLightbox()
    disconnectObservers()
  })
  document.addEventListener('pjax:complete', init)
})()
