/** Browser CSS colors are clipped to the display gamut before alpha compositing. */
import Color from 'colorjs.io';
import { contrastRatio } from '@oods/a11y-tools';

type TextColor = { fg: string; backgrounds: string[]; backgroundOpacities?: number[]; opacity?: number };
export function measureTextContrast<T extends TextColor>(pair: T) {
  const blend = (css: string, under: number[], opacity = 1): number[] => {
    const color = new Color(css).to('srgb');
    const alpha = Number(color.alpha) * opacity;
    return color.coords.map((value, index) => Math.max(0, Math.min(1, Number(value))) * alpha + under[index]! * (1 - alpha));
  };
  const hex = (rgb: number[]): string => '#' + rgb.map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('');
  const backgroundRgb = pair.backgrounds.map((css,index)=>({css,opacity:pair.backgroundOpacities?.[index]??1})).reverse().reduce((under, layer) => blend(layer.css, under, layer.opacity), [1, 1, 1]);
  const background = hex(backgroundRgb);
  const foreground = hex(blend(pair.fg, backgroundRgb, pair.opacity ?? 1));
  return { ...pair, foreground, background, ratio: contrastRatio(foreground, background) };
}

/** Serialized into the browser so the census and regression guard inspect identical paint. */
export const readVisibleText = (nodes: Element[]) => nodes.filter(el=>{
       const box=el.getBoundingClientRect(),style=getComputedStyle(el);
       // Raw text inside svg/g/title/desc is not a painted glyph. Base UI's
       // SelectIcon can retain its fallback character directly inside an svg.
       if(el instanceof SVGElement&&!(el instanceof SVGTextContentElement))return false;
       if(el instanceof SVGTextContentElement&&style.fill==='none'&&style.stroke==='none')return false;
       return !['SCRIPT','STYLE','OPTION','NOSCRIPT'].includes(el.tagName)&&box.width>1&&box.height>1&&style.visibility!=='hidden'&&style.display!=='none'&&
        (Array.from(el.childNodes).some(child=>child.nodeType===Node.TEXT_NODE&&child.textContent?.trim())||((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&(el.value||el.placeholder)&&!['checkbox','radio','hidden'].includes(el.type)));
      }).map(el=>{
       let parent:Element|null=el;const backgrounds:string[]=[],backgroundOpacities:number[]=[];let opacity=1;
       let paintLimit:string|null=null,svgBackground:{fill:string;opacity:number}|null=null;
       while(parent){
        const style=getComputedStyle(parent);
        if(parent instanceof SVGSVGElement){
         // Our chart renderers paint one viewport-sized root rect before their marks.
         // Restrict this to that known shape; do not infer arbitrary overlapping marks.
         const box=parent.getBoundingClientRect();
         const rects=Array.from(parent.children).filter((child):child is SVGRectElement=>child instanceof SVGRectElement);
         const rect=rects.find(child=>{const painted=child.getBoundingClientRect();return Boolean(child.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)&&painted.left<=box.left+.5&&painted.top<=box.top+.5&&painted.right>=box.right-.5&&painted.bottom>=box.bottom-.5;});
         if(rect){const paint=getComputedStyle(rect);if(paint.fill!=='none'){svgBackground={fill:paint.fill,opacity:Number(paint.fillOpacity)*Number(paint.opacity)};backgrounds.push(svgBackground.fill);backgroundOpacities.push(svgBackground.opacity);}}
         else if(rects.length)paintLimit='SVG root rectangles do not provide a known covering background';
        }
        backgrounds.push(style.backgroundColor);backgroundOpacities.push(1);opacity*=Number(style.opacity);parent=parent.parentElement;
       }
       const input=el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement;
       const placeholder=input&&!el.value&&Boolean(el.placeholder),style=getComputedStyle(el,placeholder?'::placeholder':null);
       const svg=el instanceof SVGElement;
       const strokedText=svg&&style.fill==='none';
       if(strokedText)paintLimit='SVG text painted only by stroke requires dedicated paint measurement';
       const matrix=el instanceof SVGGraphicsElement?el.getScreenCTM():null;
       const fontScale=matrix?Math.min(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)):1;
       const fontSize=parseFloat(style.fontSize)*fontScale,fontWeight=parseFloat(style.fontWeight),disabled=Boolean(el.closest(':disabled,[aria-disabled="true"]'));
       return {element:el.tagName.toLowerCase()+(el.id?'#'+el.id:''),adapter:el.closest('[data-oods-adapter]')?.getAttribute('data-oods-adapter')??null,slot:el.getAttribute('data-slot'),
        text:input?el.value||el.placeholder:Array.from(el.childNodes).filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('').trim(),kind:placeholder?'placeholder':svg?'svg-text':'text',fg:svg?(strokedText?style.stroke:style.fill):style.color,
        opacity:opacity*(placeholder?Number(style.opacity):svg?Number(strokedText?style.strokeOpacity:style.fillOpacity):1),backgrounds,backgroundOpacities,svgBackground,paintLimit,fontSize,fontScale,fontWeight,threshold:disabled?null:fontSize>=24||(fontSize>=18.66&&fontWeight>=700)?3:4.5,exemption:disabled?'inactive control':null};
      }).filter(pair=>pair.opacity>0);
