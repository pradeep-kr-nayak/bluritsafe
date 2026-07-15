var e=`bluritsafe-blurred`,t=`bluritsafe-root`,n=`bluritsafe-style`,r=`bluritsafe-highlight`,i=`bluritsafe-status`,a=`bluritsafe-selection-layer`,o=`bluritsafe-selection-box`,s=[`button`,`a`,`label`,`summary`,`[role="button"]`,`[role="link"]`,`[role="tab"]`,`[role="menuitem"]`].join(`, `),c=[`img`,`picture`,`svg`,`canvas`,`video`,`figure`].join(`, `),l=[`td`,`th`,`tr`,`thead`,`tbody`,`table`].join(`, `),u=[`pre`,`code`,`blockquote`,`h1`,`h2`,`h3`,`h4`,`h5`,`h6`,`p`,`span`,`strong`,`em`,`small`,`mark`,`figcaption`,`li`].join(`, `),d=[`article`,`section`,`header`,`footer`,`aside`,`main`,`nav`,`figure`,`div`].join(`, `);if(typeof window.__blurItSafeCleanup==`function`)try{window.__blurItSafeCleanup()}catch{}f();function f(){T();let f={blurModeEnabled:!1,blurIntensity:10,selectionModeEnabled:!1,isDraggingSelection:!1,isDraggingStatus:!1,blurredElements:new Set,selectionStart:null,selectionRect:null,restoreCaptureUiTimer:null,captureSuppressedUntil:0,statusPointerId:null,statusOffset:{x:0,y:0}},p=[],m=w(),h=m.root,g=m.highlightBox,_=m.statusPill,v=m.selectionLayer,y=m.selectionBox;E(),D(),O(),x(document,`mousemove`,A,!0),x(document,`click`,j,!0),x(window,`keydown`,M,!0),x(v,`mousedown`,N,!0),x(window,`mousemove`,P,!0),x(window,`mouseup`,F,!0),x(_,`pointerdown`,I,!0),x(window,`pointermove`,L,!0),x(window,`pointerup`,R,!0);let b=(e,t,n)=>e.type===`GET_STATE`?(n(C()),!1):e.type===`SET_BLUR_MODE`?(f.blurModeEnabled=!!e.enabled,f.selectionModeEnabled=!1,f.isDraggingSelection=!1,J(),E(),D(),n(C()),!1):e.type===`SET_BLUR_INTENSITY`?(f.blurIntensity=W(e.value),O(),n(C()),!1):e.type===`CLEAR_BLURS`?(U(),E(),n(C()),!1):e.type===`START_SELECTION_CAPTURE`?(f.blurModeEnabled=!1,f.selectionModeEnabled=!0,f.isDraggingSelection=!1,Y(),E(`Drag to select an area`),D(),n(C()),!1):e.type===`PREPARE_CAPTURE`?(Z(),Q().then(()=>n({ok:!0})),!0):!1;chrome.runtime.onMessage.addListener(b),window.__blurItSafeCleanup=S;function x(e,t,n,r=!1){e.addEventListener(t,n,r),p.push(()=>e.removeEventListener(t,n,r))}function S(){for(clearTimeout(f.restoreCaptureUiTimer);p.length>0;){let e=p.pop();try{e()}catch{}}chrome.runtime.onMessage.removeListener(b),T(),delete window.__blurItSafeCleanup}function C(){return{blurModeEnabled:f.blurModeEnabled,blurIntensity:f.blurIntensity,selectionModeEnabled:f.selectionModeEnabled,blurredCount:f.blurredElements.size}}function w(){let s=document.createElement(`div`);s.id=t,s.setAttribute(`aria-hidden`,`true`),s.innerHTML=`
      <div id="${r}"></div>
      <div id="${i}"></div>
      <div id="${a}">
        <div id="${o}"></div>
      </div>
    `;let c=document.createElement(`style`);return c.id=n,c.textContent=`
      #${t} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
      }

      #${r} {
        position: fixed;
        display: none;
        border: 2px solid rgba(12, 111, 255, 0.95);
        background: rgba(12, 111, 255, 0.12);
        border-radius: 10px;
        box-shadow: 0 0 0 200vmax rgba(6, 18, 40, 0);
      }

      #${i} {
        position: fixed;
        top: 16px;
        right: 16px;
        max-width: 260px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(10, 24, 43, 0.92);
        color: #fff;
        font:
          600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px rgba(2, 16, 41, 0.28);
        cursor: grab;
        pointer-events: auto;
        user-select: none;
      }

      #${a} {
        position: fixed;
        inset: 0;
        display: none;
        pointer-events: none;
        cursor: crosshair;
        background: rgba(9, 20, 38, 0.12);
      }

      #${o} {
        position: fixed;
        display: none;
        border: 2px dashed rgba(255, 255, 255, 0.96);
        background:
          linear-gradient(135deg, rgba(31, 120, 255, 0.35), rgba(24, 219, 176, 0.2));
        box-shadow: 0 0 0 9999px rgba(2, 15, 31, 0.35);
      }

      .${e} {
        filter: blur(var(--bluritsafe-blur-intensity, 10px)) !important;
        transition: filter 120ms ease;
      }
    `,document.documentElement.append(s,c),{root:s,highlightBox:s.querySelector(`#${r}`),statusPill:s.querySelector(`#${i}`),selectionLayer:s.querySelector(`#${a}`),selectionBox:s.querySelector(`#${o}`)}}function T(){document.querySelectorAll(`#${t}`).forEach(e=>e.remove()),document.querySelectorAll(`#${n}`).forEach(e=>e.remove())}function E(e){if(e){_.style.display=`block`,_.textContent=e;return}if(f.selectionModeEnabled){_.style.display=`block`,_.textContent=`Drag to select an area`;return}if(f.blurModeEnabled){_.style.display=`block`,_.textContent=`Blur mode: click any item to blur or unblur`;return}if(f.blurredElements.size===0){_.style.display=`none`;return}_.style.display=`block`,_.textContent=`Blurred items: ${f.blurredElements.size}`}function D(){v.style.display=f.selectionModeEnabled?`block`:`none`,v.style.pointerEvents=f.selectionModeEnabled?`auto`:`none`}function O(){let e=`${f.blurIntensity}px`;document.documentElement.style.setProperty(`--bluritsafe-blur-intensity`,e);for(let t of f.blurredElements){if(!document.documentElement.contains(t)){f.blurredElements.delete(t);continue}t.style.setProperty(`--bluritsafe-blur-intensity`,e)}}function k(e){return!!e?.closest?.(`#${t}`)}function A(e){if(Date.now()<f.captureSuppressedUntil){Y();return}if(!f.blurModeEnabled||f.selectionModeEnabled){Y();return}if(k(e.target)){Y();return}let t=z(e.target);if(!t){Y();return}let n=t.getBoundingClientRect();if(n.width<4||n.height<4){Y();return}g.style.display=`block`,g.style.top=`${n.top}px`,g.style.left=`${n.left}px`,g.style.width=`${n.width}px`,g.style.height=`${n.height}px`}function j(e){if(!f.blurModeEnabled||f.selectionModeEnabled||k(e.target))return;let t=z(e.target);t&&(e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),H(t),E())}function M(e){if(e.key===`Escape`){if(f.selectionModeEnabled){X(),E(`Selection cancelled`),window.setTimeout(()=>E(),1e3);return}f.blurModeEnabled&&(f.blurModeEnabled=!1,Y(),E(`Blur mode off`),window.setTimeout(()=>E(),1e3))}}function N(e){f.selectionModeEnabled&&(e.preventDefault(),e.stopPropagation(),f.isDraggingSelection=!0,f.selectionStart={x:e.clientX,y:e.clientY},f.selectionRect={x:e.clientX,y:e.clientY,width:0,height:0},q(f.selectionRect))}function P(e){if(!f.selectionModeEnabled||!f.isDraggingSelection||!f.selectionStart)return;let t=K(f.selectionStart,{x:e.clientX,y:e.clientY});f.selectionRect=t,q(t)}function F(e){if(!f.selectionModeEnabled||!f.isDraggingSelection||!f.selectionStart)return;e.preventDefault(),e.stopPropagation(),f.isDraggingSelection=!1;let t=K(f.selectionStart,{x:e.clientX,y:e.clientY});if(t.width<12||t.height<12){X(),E(`Selection too small`),window.setTimeout(()=>E(),1e3);return}f.selectionRect=t,$(t)}function I(e){if(f.selectionModeEnabled)return;let t=_.getBoundingClientRect();f.isDraggingStatus=!0,f.statusPointerId=e.pointerId,f.statusOffset={x:e.clientX-t.left,y:e.clientY-t.top},_.style.cursor=`grabbing`,_.setPointerCapture?.(e.pointerId),e.preventDefault(),e.stopPropagation()}function L(e){if(!f.isDraggingStatus||f.statusPointerId!==e.pointerId)return;let t=_.getBoundingClientRect(),n=Math.max(8,window.innerWidth-t.width-8),r=Math.max(8,window.innerHeight-t.height-8),i=G(e.clientX-f.statusOffset.x,8,n),a=G(e.clientY-f.statusOffset.y,8,r);_.style.left=`${i}px`,_.style.top=`${a}px`,_.style.right=`auto`}function R(e){!f.isDraggingStatus||f.statusPointerId!==e.pointerId||(f.isDraggingStatus=!1,f.statusPointerId=null,_.style.cursor=`grab`,_.releasePointerCapture?.(e.pointerId))}function z(e){let t=e instanceof Element?e:e?.parentElement;if(!t||!document.documentElement.contains(t))return null;let n=t.closest(s);if(B(n))return n;let r=t.closest(`td, th`);if(B(r))return r;let i=t.closest(c);if(B(i))return i;let a=t.closest(u);if(B(a))return a;let o=t.closest(l);return B(o)?o:V(t)}function B(e){if(!(e instanceof Element)||k(e)||e===document.body||e===document.documentElement)return!1;let t=e.getBoundingClientRect();return!(t.width<4||t.height<4)}function V(e){let t=window.innerWidth*window.innerHeight,n=e,r=null,i=-1/0,a=0;for(;n&&n!==document.body&&n!==document.documentElement;){if(B(n)&&n.matches(d)){let e=n.getBoundingClientRect(),o=e.width*e.height,s=t>0?o/t:0,c=n.textContent?.trim()?18:0,l=s>.55?70:s>.35?35:0,u=(n.tagName===`DIV`?14:20)+c-a*8-l;u>i&&(i=u,r=n)}n=n.parentElement,a+=1}return r||(B(e)?e:null)}function H(t){t.classList.toggle(e)?(t.style.setProperty(`--bluritsafe-blur-intensity`,`${f.blurIntensity}px`),f.blurredElements.add(t)):(t.style.removeProperty(`--bluritsafe-blur-intensity`),f.blurredElements.delete(t))}function U(){for(let t of f.blurredElements)t.classList.remove(e),t.style.removeProperty(`--bluritsafe-blur-intensity`);f.blurredElements.clear()}function W(e){let t=Number(e);return Number.isFinite(t)?Math.min(24,Math.max(2,Math.round(t))):10}function G(e,t,n){return Math.min(Math.max(e,t),n)}function K(e,t){return{x:Math.min(e.x,t.x),y:Math.min(e.y,t.y),width:Math.abs(t.x-e.x),height:Math.abs(t.y-e.y)}}function q(e){y.style.display=`block`,y.style.left=`${e.x}px`,y.style.top=`${e.y}px`,y.style.width=`${e.width}px`,y.style.height=`${e.height}px`}function J(){y.style.display=`none`}function Y(){g.style.display=`none`}function X(){f.selectionModeEnabled=!1,f.isDraggingSelection=!1,f.selectionStart=null,f.selectionRect=null,J(),D()}function Z(){clearTimeout(f.restoreCaptureUiTimer),f.captureSuppressedUntil=Date.now()+900,Y(),J(),h.style.visibility=`hidden`,f.restoreCaptureUiTimer=window.setTimeout(()=>{f.captureSuppressedUntil=0,h.style.visibility=`visible`,E()},900)}function Q(){return new Promise(e=>{window.requestAnimationFrame(()=>{window.requestAnimationFrame(()=>{window.setTimeout(e,180)})})})}function $(e){X(),Z(),window.setTimeout(async()=>{try{let t=await chrome.runtime.sendMessage({type:`CAPTURE_SELECTION`,rect:e,viewport:{width:window.innerWidth,height:window.innerHeight}});if(!t?.ok){E(t?.error||`Capture failed`),window.setTimeout(()=>E(),1200);return}E(`Selection downloaded`),window.setTimeout(()=>E(),1200)}catch(e){E(e.message||`Capture failed`),window.setTimeout(()=>E(),1200)}},180)}}