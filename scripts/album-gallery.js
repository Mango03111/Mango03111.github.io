'use strict'

const urlFor = require('hexo-util').url_for.bind(hexo)

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const safeId = value => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'section'

const getImageDimensions = photo => {
  const width = Number(photo.width)
  const height = Number(photo.height)

  if (width > 0 && height > 0) return { width, height }

  const match = String(photo.url || '').match(/\/(\d+)[xX](\d+)\//)
  if (!match) return null

  return { width: Number(match[1]), height: Number(match[2]) }
}

const renderPhoto = (photo, lightboxGroup) => {
  const url = urlFor(photo.url || '')
  const alt = photo.alt || photo.caption || ''
  const caption = photo.caption || alt
  const accessibleName = caption || alt || '相册照片'
  const dimensions = getImageDimensions(photo)
  const dimensionsHtml = dimensions
    ? ` width="${dimensions.width}" height="${dimensions.height}"`
    : ''
  const captionHtml = photo.caption
    ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>`
    : ''

  return `<figure class="album-photo">
    <button class="album-photo-trigger" type="button" data-album-group="${escapeHtml(lightboxGroup)}" data-src="${escapeHtml(url)}" data-caption="${escapeHtml(caption)}" aria-label="放大查看：${escapeHtml(accessibleName)}" aria-haspopup="dialog">
      <img class="no-lightbox" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" decoding="async"${dimensionsHtml}>
    </button>
    ${captionHtml}
  </figure>`
}

const renderSection = (albumId, groupIndex, section, sectionIndex) => {
  const photos = Array.isArray(section.photos) ? section.photos : []
  const lightboxGroup = [safeId(albumId), groupIndex + 1, sectionIndex + 1].join('-')
  const description = section.description
    ? `<p>${escapeHtml(section.description)}</p>`
    : ''

  return `<section class="album-section">
    <header class="album-section-heading">
      <h3>${escapeHtml(section.title || '')}</h3>
      ${description}
    </header>
    <div class="album-waterfall" data-photo-count="${photos.length}" aria-label="${escapeHtml(section.title || '相册分组')}">
      ${photos.map(photo => renderPhoto(photo, lightboxGroup)).join('\n')}
    </div>
  </section>`
}

const renderGroup = (albumId, group, groupIndex) => {
  const sections = Array.isArray(group.sections) ? group.sections : []
  const description = group.description
    ? `<p>${escapeHtml(group.description)}</p>`
    : ''

  return `<section class="album-period">
    <header class="album-period-heading">
      <h2>${escapeHtml(group.title || '')}</h2>
      ${description}
    </header>
    ${sections.map((section, sectionIndex) => renderSection(albumId, groupIndex, section, sectionIndex)).join('\n')}
  </section>`
}

const albumGallery = args => {
  const albumId = args[0]
  const data = hexo.locals.get('data') || {}
  const albums = data.albums || {}
  const album = albums[albumId]

  if (!album) {
    hexo.log.warn(`Album data not found: ${albumId}`)
    return `<p class="album-empty">暂未找到相册：${escapeHtml(albumId)}</p>`
  }

  const groups = Array.isArray(album.groups) ? album.groups : []
  const description = album.description
    ? `<p class="album-intro">${escapeHtml(album.description)}</p>`
    : ''

  return `<div class="mango-album" data-album="${escapeHtml(albumId)}">
    ${description}
    ${groups.map((group, groupIndex) => renderGroup(albumId, group, groupIndex)).join('\n')}
  </div>`
}

hexo.extend.tag.register('albumGallery', albumGallery)
