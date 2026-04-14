hexo.extend.helper.register('category_cards', function (type) {
    const conf = hexo.config.theme_config
    let result = `<div class="category-cards">`
    //遍历所有标签/目录
    hexo.locals.get(type).map(function (item) {

        //获取变量
        if (eval('conf.' + type) && eval('conf.' + type + '.' + item.name)) {
            var itemdesc = eval('conf.' + type + '.' + item.name + '.desc') ? eval('conf.' + type + '.' + item.name + '.desc') : ''
            var itemimg = eval('conf.' + type + '.' + item.name + '.img') ? eval('conf.' + type + '.' + item.name + '.img') : item.posts.data[0].cover //默认封面
            var itemclo1 = eval('conf.' + type + '.' + item.name + '.color1') ? eval('conf.' + type + '.' + item.name + '.color1') : '#8B00BB' //默认颜色1
            var itemclo2 = eval('conf.' + type + '.' + item.name + '.color2') ? eval('conf.' + type + '.' + item.name + '.color2') : '#030094' //默认颜色2
        }
        else {
            var itemdesc = ''
            var itemimg = item.posts.data[0].cover
            var itemclo1 = '#8B00BB' //默认颜色1
            var itemclo2 = '#030094' //默认颜色2
        }

        result += `<div class="category-card">`

        //卡片正面
        result += `<div class="category-card-front" style="border-color:${itemclo1}">
                     <div class="card-front-img" style="background-image:var(--ichika-categorycard-bg),url('${itemimg}')"></div>
                     <div class="card-front-title" style="border-color:${itemclo1}">${item.name}</div>
                     <div class="card-front-desc">${itemdesc}</div>
                     <div class="card-front-amount">${item.length}篇文章</div>
                   </div>`


        //卡片背面
        let itemcontent = ''
        for (i = 1; i < 4 && i < item.posts.length + 1; i++) {
            let post = item.posts.data[item.posts.length - i]
            
            itemcontent += `<li><a href='/${post.path}'>${post.title}</a></li>`
        }
        result += `<div class="category-card-back" style="border-color:${itemclo1};background: linear-gradient(to top left, ${itemclo1} 0%, ${itemclo2} 100%) ;">
                     <a href="/${item.path}"></a>
                     <div class="card-back-title" style="border-color:${itemclo1}">${item.name}</div>
                     <ul class="card-back-content">${itemcontent}</ul>
                     <a href="/${item.path}" class="card-back-more">更多>></a>
                   </div>`

        result += `</div>`
    })
    result += `</div>`
    return result
})
