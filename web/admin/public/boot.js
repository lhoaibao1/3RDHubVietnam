setTimeout(function () {
  var a = document.querySelector('.boot')
  if (a) a.innerHTML = 'Tải trang quản trị đang lâu hơn bình thường. <a href="" id="rl">Tải lại</a> hoặc bấm Ctrl+F5.'
  var l = document.getElementById('rl')
  if (l) l.onclick = function () { location.reload(); return false }
}, 10000)
