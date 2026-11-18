import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SurveyBanner } from '../components/SurveyBanner'

const props = { surveyId: 'PLHDDnU', href: 'https://v.wjx.cn/vm/PLHDDnU.aspx#' }
beforeEach(() => sessionStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('shows exact copy and a safe external questionnaire link', () => {
  render(<SurveyBanner {...props} />)
  expect(screen.getByText('你平时如何练习声音？我们正在探索新的声音训练产品，邀你填写约2分钟的问卷，报名参与用户访谈。')).toBeTruthy()
  const link = screen.getByRole('link', { name: '你平时如何练习声音？我们正在探索新的声音训练产品，邀你填写约2分钟的问卷，报名参与用户访谈。' })
  expect(link.getAttribute('href')).toBe(props.href)
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
})
it('remembers dismissal in the session and allows a different survey', () => {
  const view = render(<SurveyBanner {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '关闭问卷邀请' }))
  expect(screen.queryByRole('region')).toBeNull()
  view.unmount()
  const next = render(<SurveyBanner {...props} />)
  expect(screen.queryByRole('region')).toBeNull()
  next.rerender(<SurveyBanner {...props} surveyId="next" />)
  expect(screen.getByRole('region')).toBeTruthy()
})
it('remains usable when session storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  render(<SurveyBanner {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '关闭问卷邀请' }))
  expect(screen.queryByRole('region')).toBeNull()
})

it('keeps the close button outside the questionnaire link', () => {
  const onDismiss = vi.fn()
  render(<SurveyBanner {...props} onDismiss={onDismiss} />)
  const close = screen.getByRole('button', { name: '关闭问卷邀请' })
  expect(close.closest('a')).toBeNull()
  expect(screen.getByRole('link').textContent).toBe('你平时如何练习声音？我们正在探索新的声音训练产品，邀你填写约2分钟的问卷，报名参与用户访谈。')
  fireEvent.click(close)
  expect(onDismiss).toHaveBeenCalledOnce()
})
