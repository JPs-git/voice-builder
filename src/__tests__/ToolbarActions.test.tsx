import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {Toolbar} from '../components/Toolbar'
afterEach(cleanup)
it('keeps frequent actions visible and puts secondary actions in a dismissible menu',()=>{
 const click=vi.fn()
 const items=['record','cancel','import','playback','clear','config','help','about'].map(id=>({id,variant:'ghost' as const,icon:'•',label:id}))
 render(<Toolbar compactActions toolItems={items} onToolClick={click}/>)
 for(const id of ['record','cancel','import','playback'])expect(screen.getByRole('button',{name:id})).toBeTruthy()
 expect(screen.queryByRole('button',{name:/help/})).toBeNull()
 const more=screen.getByRole('button',{name:'更多操作'})
 fireEvent.click(more)
 fireEvent.click(screen.getByRole('menuitem',{name:/help/}))
 expect(click).toHaveBeenCalledWith('help')
 expect(screen.queryByRole('menu')).toBeNull()
 expect(document.activeElement).toBe(more)
 fireEvent.click(more);fireEvent.keyDown(document,{key:'Escape'})
 expect(screen.queryByRole('menu')).toBeNull()
 fireEvent.click(more);fireEvent.pointerDown(document.body)
 expect(screen.queryByRole('menu')).toBeNull()
})
