(() => {
  'use strict'

  const SETTINGS = {
    desktopCount: 80,
    mobileCount: 32,
    mobileBreakpoint: 600,
    maxDevicePixelRatio: 2,
    minRadius: 0.9,
    maxRadius: 2.5,
    maxSpeed: 0.009,
    minSpeed: 0.0025
  }

  const state = {
    animationFrame: null,
    canvas: null,
    context: null,
    height: 0,
    lastTime: 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
    stars: [],
    width: 0
  }

  const isHomePage = () => window.GLOBAL_CONFIG_SITE?.pageType === 'home'

  const randomBetween = (min, max) => min + Math.random() * (max - min)

  const createStar = () => {
    const red = Math.round(randomBetween(188, 220))
    const green = Math.round(randomBetween(138, 178))
    const blue = Math.round(randomBetween(248, 255))

    return {
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      radius: randomBetween(SETTINGS.minRadius, SETTINGS.maxRadius),
      angle: Math.random() * Math.PI * 2,
      speed: randomBetween(SETTINGS.minSpeed, SETTINGS.maxSpeed),
      driftPhaseA: Math.random() * Math.PI * 2,
      driftPhaseB: Math.random() * Math.PI * 2,
      driftSpeedA: randomBetween(0.00008, 0.00018),
      driftSpeedB: randomBetween(0.000025, 0.000065),
      turnStrength: randomBetween(0.000008, 0.000024),
      baseAlpha: randomBetween(0.28, 0.68),
      twinklePhaseA: Math.random() * Math.PI * 2,
      twinklePhaseB: Math.random() * Math.PI * 2,
      twinkleSpeedA: randomBetween(0.00065, 0.0016),
      twinkleSpeedB: randomBetween(0.0017, 0.0032),
      color: `${red}, ${green}, ${blue}`,
      glow: Math.random() < 0.18
    }
  }

  const createStars = () => {
    const count = window.innerWidth <= SETTINGS.mobileBreakpoint
      ? SETTINGS.mobileCount
      : SETTINGS.desktopCount

    state.stars = Array.from({ length: count }, createStar)
  }

  const resizeCanvas = () => {
    if (!state.canvas || !state.context) return

    const oldWidth = state.width
    const oldHeight = state.height
    const rect = state.canvas.parentElement.getBoundingClientRect()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, SETTINGS.maxDevicePixelRatio)

    state.width = Math.max(1, rect.width)
    state.height = Math.max(1, rect.height)
    state.canvas.width = Math.round(state.width * pixelRatio)
    state.canvas.height = Math.round(state.height * pixelRatio)
    state.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    if (!state.stars.length) {
      createStars()
    } else {
      const widthRatio = oldWidth ? state.width / oldWidth : 1
      const heightRatio = oldHeight ? state.height / oldHeight : 1
      state.stars.forEach(star => {
        star.x *= widthRatio
        star.y *= heightRatio
      })

      const expectedCount = window.innerWidth <= SETTINGS.mobileBreakpoint
        ? SETTINGS.mobileCount
        : SETTINGS.desktopCount
      if (state.stars.length !== expectedCount) createStars()
    }

    draw(performance.now(), 0)
  }

  const wrapStar = star => {
    const margin = 3
    if (star.x < -margin) star.x = state.width + margin
    if (star.x > state.width + margin) star.x = -margin
    if (star.y < -margin) star.y = state.height + margin
    if (star.y > state.height + margin) star.y = -margin
  }

  const draw = (time, delta) => {
    if (!state.context) return

    state.context.clearRect(0, 0, state.width, state.height)

    state.stars.forEach(star => {
      if (delta > 0) {
        const turn = (
          Math.sin(time * star.driftSpeedA + star.driftPhaseA) +
          Math.sin(time * star.driftSpeedB + star.driftPhaseB) * 0.65
        ) * star.turnStrength * delta

        star.angle += turn
        star.x += Math.cos(star.angle) * star.speed * delta
        star.y += Math.sin(star.angle) * star.speed * delta
        wrapStar(star)
      }

      const twinkle = 0.62 +
        Math.sin(time * star.twinkleSpeedA + star.twinklePhaseA) * 0.25 +
        Math.sin(time * star.twinkleSpeedB + star.twinklePhaseB) * 0.13
      const alpha = Math.max(0.08, Math.min(0.82, star.baseAlpha * twinkle))

      state.context.beginPath()
      state.context.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      state.context.fillStyle = `rgba(${star.color}, ${alpha})`
      state.context.shadowBlur = star.glow ? 1.5 : 0
      state.context.shadowColor = `rgba(${star.color}, ${alpha * 0.7})`
      state.context.fill()
    })

    state.context.shadowBlur = 0
  }

  const animate = time => {
    if (!state.canvas || document.hidden || state.reducedMotion.matches) return

    const delta = state.lastTime ? Math.min(time - state.lastTime, 50) : 0
    state.lastTime = time
    draw(time, delta)
    state.animationFrame = window.requestAnimationFrame(animate)
  }

  const startAnimation = () => {
    if (!state.canvas || document.hidden || state.reducedMotion.matches || state.animationFrame) return
    state.lastTime = 0
    state.animationFrame = window.requestAnimationFrame(animate)
  }

  const stopAnimation = () => {
    if (state.animationFrame) window.cancelAnimationFrame(state.animationFrame)
    state.animationFrame = null
    state.lastTime = 0
  }

  const destroy = () => {
    stopAnimation()
    state.canvas?.remove()
    state.canvas = null
    state.context = null
    state.stars = []
    state.width = 0
    state.height = 0
  }

  const init = () => {
    if (!isHomePage()) {
      destroy()
      return
    }

    const background = document.getElementById('web_bg')
    if (!background) return

    if (!state.canvas) {
      const canvas = document.createElement('canvas')
      canvas.id = 'home-starfield'
      canvas.setAttribute('aria-hidden', 'true')
      Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '1'
      })

      background.appendChild(canvas)
      state.canvas = canvas
      state.context = canvas.getContext('2d')
    }

    resizeCanvas()
    if (state.reducedMotion.matches) {
      draw(performance.now(), 0)
    } else {
      startAnimation()
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden) stopAnimation()
    else startAnimation()
  }

  const handleMotionPreference = () => {
    stopAnimation()
    if (state.reducedMotion.matches) draw(performance.now(), 0)
    else startAnimation()
  }

  let resizeTimer = null
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(resizeCanvas, 140)
  })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('pjax:send', stopAnimation)
  document.addEventListener('pjax:complete', init)
  state.reducedMotion.addEventListener('change', handleMotionPreference)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
