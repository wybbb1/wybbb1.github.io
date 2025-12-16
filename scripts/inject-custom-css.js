/* global hexo */

// 注入自定义 CSS
hexo.extend.injector.register('head_end', () => {
  return '<link rel="stylesheet" href="/css/custom.css">';
}, 'default');
