/*
 * 右下角小提示浮层组件
 *
 * 生命周期:
 *   加载 → 滑入第一条提示 → 停留 5s → 滑出 → 隐藏 5s →
 *   切换下一条 → 滑入 → 停留 5s → 滑出 → ...（循环）
 *
 * 两个计时器交替驱动:
 *   _showTimerId — 控制"展示阶段"的时长，到期触发滑出
 *   _hideTimerId — 控制"隐藏阶段"的时长，到期触发下一条滑入
 *
 * 用户交互:
 *   鼠标进入卡片 → 取消 _showTimer（暂停，卡片保持可见）
 *   鼠标离开卡片 → 重启 _showTimer
 *   点击 ×  → 关闭（隐藏卡片，停止轮播，显示 ℹ）
 *   点击 ℹ  → 展开（随机选一条，显示卡片，开始轮播）
 */

export class TipWidget {
  constructor(tips, options = {}) {
    this.tips = tips
    this.interval = options.interval ?? 5000
    this._index = this._pickNext()
    this._isOpen = true       // 用户是否处于"展开"状态
    this._isAnimating = false // 动画进行中，阻止交互打断
    this._isHidden = false    // 卡片当前是否处于隐藏阶段
    this._showTimerId = null  // 展示阶段计时器（到期滑出）
    this._hideTimerId = null  // 隐藏阶段计时器（到期滑入下一条）

    this._buildDOM()
    this._bindEvents()
    this._syncClosedClass()
    this._showTip()
  }

  /* 随机选取下一条提示的索引 */
  _pickNext() {
    return Math.floor(Math.random() * this.tips.length)
  }

  _buildDOM() {
    this._el = document.createElement('aside')
    this._el.className = 'tip-widget'
    this._el.id = 'tipWidget'

    this._trigger = document.createElement('button')
    this._trigger.className = 'tip-trigger'
    this._trigger.setAttribute('aria-label', '小提示')
    this._trigger.textContent = 'ℹ'

    this._card = document.createElement('div')
    this._card.className = 'tip-card'

    this._closeBtn = document.createElement('button')
    this._closeBtn.className = 'tip-close'
    this._closeBtn.setAttribute('aria-label', '关闭小提示')
    this._closeBtn.textContent = '×'

    this._titleEl = document.createElement('h4')
    this._titleEl.className = 'tip-title'
    this._titleEl.textContent = '💡 小提示'

    this._textEl = document.createElement('p')
    this._textEl.className = 'tip-text'
    this._textEl.textContent = this.tips[this._index]

    this._card.appendChild(this._closeBtn)
    this._card.appendChild(this._titleEl)
    this._card.appendChild(this._textEl)
    this._el.appendChild(this._trigger)
    this._el.appendChild(this._card)
    document.body.appendChild(this._el)
  }

  /* 根据 _isOpen 切换是-closed 类，控制 ℹ 按钮显隐 */
  _syncClosedClass() {
    this._el.classList.toggle('is-closed', !this._isOpen)
  }

  _bindEvents() {
    this._onTriggerClick = () => this._open()
    this._onCloseClick = () => this._close()
    this._onCardEnter = () => {
      if (this._isHidden) return
      if (this._showTimerId !== null) {
        clearTimeout(this._showTimerId)
        this._showTimerId = null
      }
    }
    this._onCardLeave = () => {
      if (this._isHidden) return
      if (this._showTimerId === null && this._isOpen) {
        this._startShowTimer()
      }
    }

    this._trigger.addEventListener('click', this._onTriggerClick)
    this._closeBtn.addEventListener('click', this._onCloseClick)
    this._card.addEventListener('mouseenter', this._onCardEnter)
    this._card.addEventListener('mouseleave', this._onCardLeave)
  }

  /* 点击 × 关闭：停止轮播 → 滑出 → 隐藏卡片 → 显示 ℹ */
  _close() {
    if (this._isAnimating || !this._isOpen) return
    this._stopTimers()
    this._isOpen = false
    this._animateOut(() => {
      this._card.hidden = true
      this._syncClosedClass()
    })
  }

  /* 点击 ℹ 展开：隐藏 ℹ → 随机选一条 → 滑入 → 开始轮播 */
  _open() {
    if (this._isAnimating || this._isOpen) return
    this._isOpen = true
    this._syncClosedClass()
    this._index = this._pickNext()
    this._textEl.textContent = this.tips[this._index]
    this._card.hidden = false
    this._isHidden = false
    this._animateIn(() => this._startShowTimer())
  }

  /* 展示当前提示：取消隐藏 → 滑入 → 启动展示计时器 */
  _showTip() {
    this._card.hidden = false
    this._isHidden = false
    this._animateIn(() => this._startShowTimer())
  }

  /* 展示阶段计时器：等待 interval → 滑出 → 进入隐藏阶段 */
  _startShowTimer() {
    this._showTimerId = setTimeout(() => {
      this._animateOut(() => this._startHideTimer())
    }, this.interval)
  }

  /* 隐藏阶段计时器：隐藏卡片 → 等待 interval → 随机下一条 → 重新展示 */
  _startHideTimer() {
    this._card.hidden = true
    this._isHidden = true
    this._hideTimerId = setTimeout(() => {
      this._index = this._pickNext()
      this._textEl.textContent = this.tips[this._index]
      this._showTip()
    }, this.interval)
  }

  /* 播放滑入动画（从右进入），动画结束后回调 */
  _animateIn(cb) {
    this._isAnimating = true
    this._card.classList.remove('slide-out')
    this._card.classList.add('slide-in')
    this._card.addEventListener('animationend', () => {
      this._card.classList.remove('slide-in')
      this._isAnimating = false
      if (cb) cb()
    }, { once: true })
  }

  /* 播放滑出动画（向右退出），动画结束后回调 */
  _animateOut(cb) {
    this._isAnimating = true
    this._card.classList.remove('slide-in')
    this._card.classList.add('slide-out')
    this._card.addEventListener('animationend', () => {
      this._card.classList.remove('slide-out')
      this._isAnimating = false
      if (cb) cb()
    }, { once: true })
  }

  /* 清除两个阶段计时器 */
  _stopTimers() {
    if (this._showTimerId !== null) {
      clearTimeout(this._showTimerId)
      this._showTimerId = null
    }
    if (this._hideTimerId !== null) {
      clearTimeout(this._hideTimerId)
      this._hideTimerId = null
    }
  }

  destroy() {
    this._stopTimers()
    this._trigger.removeEventListener('click', this._onTriggerClick)
    this._closeBtn.removeEventListener('click', this._onCloseClick)
    this._card.removeEventListener('mouseenter', this._onCardEnter)
    this._card.removeEventListener('mouseleave', this._onCardLeave)
    this._el.remove()
  }
}
