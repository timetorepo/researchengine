import { useRef, useState } from 'react'
import { Bold, Italic, Heading2, List, Code } from 'lucide-react'
import type { BoardItem } from '@/lib/board/storage'
import { BoardMarkdown } from './BoardMarkdown'

type Props={item:BoardItem;onChange:(patch:Partial<BoardItem>)=>void}
export function BoardNoteEditor({item,onChange}:Props) {
  const input=useRef<HTMLTextAreaElement>(null),[preview,setPreview]=useState(false)
  function format(before:string,after:string,fallback:string) {
    const el=input.current;if(!el||el.disabled||el.matches(':disabled'))return
    const start=el.selectionStart,end=el.selectionEnd,selected=item.text.slice(start,end)||fallback
    onChange({text:item.text.slice(0,start)+before+selected+after+item.text.slice(end)})
    requestAnimationFrame(()=>{if(input.current===el){el.focus();el.setSelectionRange(start+before.length,start+before.length+selected.length)}})
  }
  return <div className="re-board-note-editor">
    <label>Text format<select className="bui-field" aria-label="Item text format" value={item.textFormat??'plain'} onChange={event=>{setPreview(false);onChange({textFormat:event.target.value==='markdown'?'markdown':undefined})}}><option value="plain">Plain text</option><option value="markdown">Markdown</option></select></label>
    {item.textFormat==='markdown'&&<><div className="re-board-format-tools" role="group" aria-label="Note formatting">
      {!preview&&<>{[{label:'Bold',Icon:Bold,before:'**',after:'**',text:'bold text'},{label:'Italic',Icon:Italic,before:'_',after:'_',text:'italic text'},{label:'Heading',Icon:Heading2,before:'\n## ',after:'\n',text:'Heading'},{label:'Bullet list',Icon:List,before:'\n- ',after:'\n',text:'List item'},{label:'Code',Icon:Code,before:'`',after:'`',text:'code'}].map(({label,Icon,before,after,text})=><button className="bui-button" type="button" key={label} aria-label={`Format ${label.toLowerCase()}`} title={label} onClick={()=>format(before,after,text)}><Icon size={14} aria-hidden="true"/></button>)}</>}
      <button className="bui-button" type="button" aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?'Edit Markdown':'Preview Markdown'}</button>
    </div><p className="re-board-format-help">Markdown source stays editable. Raw HTML is hidden; remote images are not loaded. Preview links open only when clicked.</p></>}
    {preview&&item.textFormat==='markdown'?<div className="re-board-note-preview" role="region" aria-label="Note Markdown preview"><BoardMarkdown text={item.text}/>{!item.text&&<p>Nothing to preview yet.</p>}</div>:<label>Note or annotation<textarea ref={input} className="bui-field" aria-label="Item text" value={item.text} onChange={event=>onChange({text:event.target.value})} rows={7}/></label>}
  </div>
}
