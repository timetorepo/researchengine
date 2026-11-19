import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Board reading never loads remote images or raw HTML. Cards contain no interactive descendants. */
export const BoardMarkdown = memo(function BoardMarkdown({text,compact=false}:{text:string;compact?:boolean}) {
  const Root=compact?'span':'div'
  return <Root className={`re-board-markdown${compact?' re-board-markdown-compact':''}`}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    img:({alt})=><span className="re-board-image-placeholder">[Image not loaded{alt?`: ${alt}`:''}]</span>,
    a:({href,children})=>{
      let safe:string|undefined
      try {const url=new URL(href??'');if(url.protocol==='https:'||url.protocol==='http:')safe=url.href}catch{/* relative and unsafe URLs stay text */}
      return !compact&&safe?<a href={safe} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>
    },
    input:({checked})=><span role="img" aria-label={checked?'Completed task':'Incomplete task'}>{checked?'[x]':'[ ]'}</span>,
    ...(compact?{
      p:({children})=><span className="re-board-md-line">{children}</span>,
      h1:({children})=><strong className="re-board-md-line">{children}</strong>,h2:({children})=><strong className="re-board-md-line">{children}</strong>,h3:({children})=><strong className="re-board-md-line">{children}</strong>,h4:({children})=><strong className="re-board-md-line">{children}</strong>,h5:({children})=><strong className="re-board-md-line">{children}</strong>,h6:({children})=><strong className="re-board-md-line">{children}</strong>,
      ul:({children})=><span className="re-board-md-list">{children}</span>,ol:({children})=><span className="re-board-md-list re-board-md-ordered">{children}</span>,li:({children})=><span className="re-board-md-item">{children}</span>,
      pre:({children})=><span className="re-board-md-code">{children}</span>,blockquote:({children})=><span className="re-board-md-quote">{children}</span>,hr:()=> <span className="re-board-md-line">—</span>,
      table:({children})=><span>{children}</span>,thead:({children})=><span>{children}</span>,tbody:({children})=><span>{children}</span>,tr:({children})=><span className="re-board-md-line">{children}</span>,th:({children})=><strong>{children} </strong>,td:({children})=><span>{children} </span>,
    }:{})
  }}>{text}</ReactMarkdown></Root>
})
