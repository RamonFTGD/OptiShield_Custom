import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { sendInteractiveMessage } = require('gifted-btns')

export const meta = {
  name: 'Math-Resolve',
  commands: ['calcular', 'resolver', 'calc', 'mr', 'mat'],
  priority: 3,
  class: 'Herramientas',
}

function round(n, dec = 10) { return Math.round(n * 10 ** dec) / 10 ** dec }
function fmt(n) {
  if (typeof n === 'bigint') { const s = n.toString(); if (s.length > 40) return s.slice(0, 30) + `... (${s.length} dígitos)`; return s }
  if (typeof n === 'number') { if (!isFinite(n)) return String(n); if (Number.isInteger(n) && Math.abs(n) > 1e15) { try { return BigInt(n).toString() } catch {} } if (Math.abs(n) >= 1e9) return n.toLocaleString('en-US'); return String(round(n)) }
  return String(n)
}
function gcd(a, b) { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) { [a, b] = [b, a % b] } return a }
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b) }
function isPrime(n) { if (n < 2) return false; if (n === 2) return true; if (n % 2 === 0) return false; for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false; return true }
function primeFactors(n) { const f = []; let d = 2; while (n > 1) { while (n % d === 0) { f.push(d); n /= d } d++ } return f }
function factorial(n) { if (n < 0) throw new Error('Factorial no definido para negativos'); if (n > 20000) throw new Error('Factorial demasiado grande'); let r = 1n; for (let i = 2n; i <= BigInt(Math.round(n)); i++) r *= i; return r }
function combinations(n, k) { if (k > n) return 0n; return factorial(n) / (factorial(k) * factorial(n - k)) }
function permutations(n, k) { return factorial(n) / factorial(n - k) }
function normalizeExpr(expr) {
  let e = expr.trim()
  e = e.replace(/÷/g,'/').replace(/×/g,'*').replace(/\bmas\b/gi,'+').replace(/\bmenos\b/gi,'-').replace(/\bpor\b/gi,'*').replace(/\bentre\b/gi,'/').replace(/\bdividido\b/gi,'/').replace(/\bmultiplicar\b/gi,'*').replace(/\bsumar\b/gi,'+').replace(/\brestar\b/gi,'-')
  e = e.replace(/(\d)\s*[xX]\s*(\d)/g,'$1*$2').replace(/(\d)\s+(\d)/g,'$1*$2').replace(/\s+/g,'').replace(/,/g,'.').replace(/\^/g,'**').replace(/²/g,'**2').replace(/³/g,'**3')
  e = e.replace(/\bsen\b/gi,'Math.sin').replace(/\bsin\b/gi,'Math.sin').replace(/\bcos\b/gi,'Math.cos').replace(/\btan\b/gi,'Math.tan').replace(/\bsqrt\b/gi,'Math.sqrt').replace(/\braiz\b/gi,'Math.sqrt').replace(/\babs\b/gi,'Math.abs').replace(/\blog10\b/gi,'Math.log10').replace(/\blog\b/gi,'Math.log10').replace(/\bln\b/gi,'Math.log').replace(/\bexp\b/gi,'Math.exp').replace(/\bpi\b/gi,'Math.PI').replace(/\bfloor\b/gi,'Math.floor').replace(/\bceil\b/gi,'Math.ceil').replace(/\basin\b/gi,'Math.asin').replace(/\bacos\b/gi,'Math.acos').replace(/\batan2\b/gi,'Math.atan2').replace(/\batan\b/gi,'Math.atan').replace(/\bsinh\b/gi,'Math.sinh').replace(/\bcosh\b/gi,'Math.cosh').replace(/\btanh\b/gi,'Math.tanh')
  e = e.replace(/(\d)\(/g,'$1*(').replace(/\)(\d)/g,')*$1').replace(/\)\(/g,')*(')
  return e
}
function safeEval(expr) { const e = normalizeExpr(expr); try { const r = Function('"use strict"; return (' + e + ')')(); if (r === undefined || r === null) throw new Error('Sin resultado'); return r } catch { throw new Error('No se pudo evaluar: ' + expr) } }
function safeBigEval(expr) { const clean = expr.replace(/\s+/g,'').replace(/,/g,''); const hasDivision = clean.includes('/'); if (!hasDivision && /^[\d+\-**()\s]+$/.test(clean)) { try { const bigExpr = clean.replace(/(\d+)/g, m => m+'n'); const result = Function('"use strict"; return (' + bigExpr + ')')(); if (typeof result === 'bigint') return { big: result, float: null } } catch {} } return { big: null, float: safeEval(expr) } }
function solvePercentage(text) { let m = text.match(/(\d+\.?\d*)\s*%\s*de\s*(\d+\.?\d*)/i); if (m) { const pct = parseFloat(m[1]), total = parseFloat(m[2]), res = round((pct/100)*total); return { tipo:'Porcentaje', pasos:[`(${pct}/100)×${total}`,`= ${res}`], resultado:`${res}` } } m = text.match(/(\d+\.?\d*)\s+es\s+qu[eé]\s*%\s+de\s+(\d+\.?\d*)/i); if (m) { const parte=parseFloat(m[1]),total=parseFloat(m[2]),res=round((parte/total)*100); return { tipo:'Porcentaje inverso', pasos:[`(${parte}/${total})×100`,`= ${res}%`], resultado:`${res}%` } } return null }
function solveRuleof3(text) { const m = text.match(/(\d+\.?\d*)\s*(?:es|son|→|=)\s*(\d+\.?\d*)[,\s]+(\d+\.?\d*)\s*(?:es|son|→|=)?\s*\?/i); if (!m) return null; const a=parseFloat(m[1]),b=parseFloat(m[2]),c=parseFloat(m[3]),res=round((b*c)/a); return { tipo:'Regla de tres', pasos:[`${a}→${b}`,`${c}→x`,`x=(${b}×${c})/${a}=${res}`], resultado:`${res}` } }
function solveLinear(text) { const clean=text.replace(/\s+/g,'').replace(/,/g,'.'); const m=clean.match(/^([+-]?\d*\.?\d*)x([+-]\d+\.?\d*)?=([+-]?\d+\.?\d*)$/i); if (!m) return null; const a=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:parseFloat(m[1]),b=m[2]?parseFloat(m[2]):0,c=parseFloat(m[3]); if (b!==0){const c2=round(c-b),x=round(c2/a);return{tipo:'Ecuación lineal',pasos:[`${a}x${b>=0?'+':''}${b}=${c}`,`${a}x=${c2}`,`x=${x}`],resultado:`x=${x}`}}else{const x=round(c/a);return{tipo:'Ecuación lineal',pasos:[`${a}x=${c}`,`x=${x}`],resultado:`x=${x}`}} }
function solveQuadratic(text) { const clean=text.replace(/\s+/g,'').replace(/,/g,'.').toLowerCase(); const m=clean.match(/^([+-]?\d*\.?\d*)x[²^]2?([+-]\d*\.?\d*)x([+-]\d+\.?\d*)=0$/); if(!m)return null; const a=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:parseFloat(m[1]),b=m[2]===''||m[2]==='+'?1:m[2]==='-'?-1:parseFloat(m[2]),c=parseFloat(m[3]),disc=round(b**2-4*a*c); if(disc<0){const real=round(-b/(2*a)),imag=round(Math.sqrt(-disc)/(2*a));return{tipo:'Ecuación cuadrática',pasos:[`Δ=${disc}<0 → Complejas`],resultado:`x=${real}±${imag}i`}}if(disc===0){const x=round(-b/(2*a));return{tipo:'Ecuación cuadrática',pasos:[`Δ=0 → Doble`],resultado:`x=${x}`}}const x1=round((-b+Math.sqrt(disc))/(2*a)),x2=round((-b-Math.sqrt(disc))/(2*a));return{tipo:'Ecuación cuadrática',pasos:[`Δ=${disc}>0 → Dos reales`,`x₁=${x1}`,`x₂=${x2}`],resultado:`x₁=${x1}, x₂=${x2}`} }
function solve2x2System(text) { const lines=text.split(/[,;\n]/).map(l=>l.trim()).filter(Boolean); if(lines.length<2)return null; const parseEq=(eq)=>{const clean=eq.replace(/\s+/g,'').replace(/,/g,'.'); const m=clean.match(/^([+-]?\d*\.?\d*)x([+-]\d*\.?\d*)y=([+-]?\d+\.?\d*)$/i); if(!m)return null; const a=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:parseFloat(m[1]),b=m[2]===''||m[2]==='+'?1:m[2]==='-'?-1:parseFloat(m[2]),c=parseFloat(m[3]); return{a,b,c}}; const eq1=parseEq(lines[0]),eq2=parseEq(lines[1]); if(!eq1||!eq2)return null; const{a:a1,b:b1,c:c1}=eq1,{a:a2,b:b2,c:c2}=eq2,det=round(a1*b2-a2*b1); if(det===0)return{tipo:'Sistema 2×2',pasos:[`Det=0 → Sin solución única`],resultado:'Sin solución única'}; const x=round((c1*b2-c2*b1)/det),y=round((a1*c2-a2*c1)/det); return{tipo:'Sistema 2×2',pasos:[`${a1}x+${b1}y=${c1}`,`${a2}x+${b2}y=${c2}`,`Det=${det}`,`x=${x}, y=${y}`],resultado:`x=${x}, y=${y}`} }
function solveStats(text) { const m=text.match(/(?:media|mediana|moda|estadistica|desviacion|varianza)[^\d]*([0-9,.\s]+)/i); if(!m)return null; const nums=m[1].split(/[,\s]+/).map(Number).filter(n=>!isNaN(n)); if(nums.length<2)return null; const n=nums.length,sorted=[...nums].sort((a,b)=>a-b),mean=round(nums.reduce((s,v)=>s+v,0)/n),median=n%2===0?round((sorted[n/2-1]+sorted[n/2])/2):sorted[Math.floor(n/2)],freq={};nums.forEach(v=>{freq[v]=(freq[v]||0)+1});const maxFreq=Math.max(...Object.values(freq)),moda=Object.entries(freq).filter(([,f])=>f===maxFreq).map(([v])=>v).join(', '),variance=round(nums.reduce((s,v)=>s+(v-mean)**2,0)/n),stdDev=round(Math.sqrt(variance));return{tipo:'Estadística',pasos:[`n=${n}`,`Media=${mean}`,`Mediana=${median}`,`Moda=${moda}`,`σ=${stdDev}`],resultado:`Media=${mean}, Mediana=${median}, σ=${stdDev}`} }
function solveCombinatorics(text) { let m=text.match(/(\d+)\s*!/i); if(m){const n=parseInt(m[1]),res=factorial(n),str=fmt(res);return{tipo:'Factorial',pasos:[`${n}!=${str}`],resultado:str}} m=text.match(/[Cc]\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/); if(m){const n=parseInt(m[1]),k=parseInt(m[2]),res=combinations(n,k);return{tipo:'Combinaciones',pasos:[`C(${n},${k})=${fmt(res)}`],resultado:fmt(res)}} m=text.match(/[Pp]\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/); if(m){const n=parseInt(m[1]),k=parseInt(m[2]),res=permutations(n,k);return{tipo:'Permutaciones',pasos:[`P(${n},${k})=${fmt(res)}`],resultado:fmt(res)}} return null }
function solveNumberTheory(text) { let m=text.match(/(?:es\s+primo|primo)\s+(\d+)|(\d+)\s+(?:es\s+primo|primo)/i); if(m){const n=parseInt(m[1]||m[2]),prime=isPrime(n),factors=prime?[]:primeFactors(n);return{tipo:'Número primo',pasos:prime?[`${n} ES primo`]:[`Factores: ${factors.join('×')}`,`${n} NO es primo`],resultado:prime?`${n} es primo ✓`:`${n} no es primo (${factors.join('×')})`}} m=text.match(/(?:factori[zs]a|factores\s+primos)\s+(\d+)/i); if(m){const n=parseInt(m[1]),factors=primeFactors(n),grouped={};factors.forEach(f=>{grouped[f]=(grouped[f]||0)+1});const expr=Object.entries(grouped).map(([b,e])=>e>1?`${b}^${e}`:b).join('×');return{tipo:'Factorización',pasos:[`${n}=${expr}`],resultado:expr}} m=text.match(/(?:mcm|m\.c\.m)\s+(?:de\s+)?(\d+)[,\s]+(\d+)/i); if(m){const a=parseInt(m[1]),b=parseInt(m[2]),res=lcm(a,b);return{tipo:'MCM',pasos:[`MCM(${a},${b})=${res}`],resultado:`${res}`}} m=text.match(/(?:mcd|m\.c\.d)\s+(?:de\s+)?(\d+)[,\s]+(\d+)/i); if(m){const a=parseInt(m[1]),b=parseInt(m[2]),res=gcd(a,b);return{tipo:'MCD',pasos:[`MCD(${a},${b})=${res}`],resultado:`${res}`}} return null }
function solveGeometry(text) { let m=text.match(/(?:área|area)\s+c[íi]rculo\s+(?:radio|r)?\s*=?\s*(\d+\.?\d*)/i); if(m){const r=parseFloat(m[1]),area=round(Math.PI*r**2),peri=round(2*Math.PI*r);return{tipo:'Círculo',pasos:[`r=${r}`,`Área=π×${r}²=${area}`,`Perímetro=2π×${r}=${peri}`],resultado:`Área=${area}, Perímetro=${peri}`}} m=text.match(/(?:área|area)\s+tri[aá]ngulo\s+(?:base|b)?\s*=?\s*(\d+\.?\d*)\s*[,\s]+(?:altura|h)?\s*=?\s*(\d+\.?\d*)/i); if(m){const b=parseFloat(m[1]),h=parseFloat(m[2]),area=round(b*h/2);return{tipo:'Triángulo',pasos:[`(${b}×${h})/2=${area}`],resultado:`Área=${area}`}} m=text.match(/(?:área|area)\s+rect[aá]ngulo\s+(\d+\.?\d*)\s*[,×x\s]+\s*(\d+\.?\d*)/i); if(m){const a=parseFloat(m[1]),b=parseFloat(m[2]),area=round(a*b),peri=round(2*(a+b));return{tipo:'Rectángulo',pasos:[`${a}×${b}=${area}`,`2(${a}+${b})=${peri}`],resultado:`Área=${area}, Perímetro=${peri}`}} m=text.match(/pit[aá]goras\s+(\d+\.?\d*)\s*[,\s]+\s*(\d+\.?\d*)/i); if(m){const a=parseFloat(m[1]),b=parseFloat(m[2]),c=round(Math.sqrt(a**2+b**2));return{tipo:'Pitágoras',pasos:[`c=√(${a}²+${b}²)=${c}`],resultado:`c=${c}`}} return null }
function solveDerivative(text) { const m=text.match(/derivada\s+de\s+(.+?)\s+en\s+x\s*=\s*([+-]?\d+\.?\d*)/i); if(!m)return null; const exprRaw=m[1].trim(),x0=parseFloat(m[2]),h=1e-7,f=(x)=>safeEval(exprRaw.replace(/\bx\b/g,`(${x})`)),deriv=round((f(x0+h)-f(x0-h))/(2*h)),value=round(f(x0));return{tipo:'Derivada numérica',pasos:[`f(${x0})=${value}`,`f'(${x0})≈${deriv}`],resultado:`f'(${x0})=${deriv}`} }
function solveIntegral(text) { const m=text.match(/integral\s+de\s+(.+?)\s+de\s+([+-]?\d+\.?\d*)\s+a\s+([+-]?\d+\.?\d*)/i); if(!m)return null; const exprRaw=m[1].trim(),a=parseFloat(m[2]),b=parseFloat(m[3]),n=1000,f=(x)=>safeEval(exprRaw.replace(/\bx\b/g,`(${x})`)),h=(b-a)/n;let sum=f(a)+f(b);for(let i=1;i<n;i++)sum+=(i%2===0?2:4)*f(a+i*h);const result=round((h/3)*sum);return{tipo:'Integral definida',pasos:[`Simpson n=${n}`,`∫[${a},${b}]≈${result}`],resultado:`${result}`} }
function solveTrig(text) { const m=text.match(/\b(sen|sin|cos|tan|asin|acos|atan)\s*\(?\s*([+-]?\d+\.?\d*)\s*°?\s*\)?/i); if(!m)return null; const func=m[1].toLowerCase(),angle=parseFloat(m[2]),inDegrees=text.includes('°')||angle>Math.PI*2,rad=inDegrees?(angle*Math.PI)/180:angle,deg=inDegrees?angle:round(angle*180/Math.PI);let res;if(func==='sen'||func==='sin')res=round(Math.sin(rad));else if(func==='cos')res=round(Math.cos(rad));else if(func==='tan')res=round(Math.tan(rad));else if(func==='asin')res=round(Math.asin(inDegrees?angle:rad)*180/Math.PI);else if(func==='acos')res=round(Math.acos(inDegrees?angle:rad)*180/Math.PI);else res=round(Math.atan(angle)*180/Math.PI);return{tipo:'Trigonometría',pasos:[`${func}(${deg}°)=${res}`],resultado:`${res}`} }

function resolver(texto) {
  const solvers = [
    () => solveStats(texto), () => solveCombinatorics(texto),
    () => solveNumberTheory(texto), () => solveGeometry(texto),
    () => solvePercentage(texto), () => solveRuleof3(texto),
    () => solveDerivative(texto), () => solveIntegral(texto),
    () => solveTrig(texto), () => solve2x2System(texto),
    () => solveQuadratic(texto), () => solveLinear(texto),
  ]
  for (const solver of solvers) { try { const res = solver(); if (res) return res } catch {} }
  try {
    const { big, float } = safeBigEval(texto)
    const strInput = normalizeExpr(texto)
    const pasos = [`Expresión: ${strInput}`]
    let resultado
    if (big !== null) { const exact = fmt(big); pasos.push(`= ${exact}`); resultado = exact }
    else { const exact = round(float, 10), approx = round(float, 4), isExact = Number.isInteger(float); pasos.push(`= ${exact}`); if (!isExact) pasos.push(`≈ ${approx}`); resultado = isExact ? String(exact) : `${exact} ≈ ${approx}` }
    return { tipo: 'Expresión numérica', pasos, resultado }
  } catch {}
  return null
}

export default async function (msg, sock, ctx) {
  const { args } = ctx
  const jid = msg.key.remoteJid
  const problema = args.join(' ').trim()

  if (!problema) {
    await sendInteractiveMessage(sock, jid, {
      title: '🧮 Math-Resolve',
      text:
        `🧮 *SOLUCIONADOR DE MATEMÁTICAS*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Escribe un problema y lo resuelvo paso a paso.\n\n` +
        `*Ejemplos rápidos — toca para probar:*`,
      footer: 'OptiShield • Math-Resolve',
      interactiveButtons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '📐 Ver ejemplos',
            sections: [
              {
                title: '🔢 Operaciones básicas',
                rows: [
                  { id: '.calc 200x4',            title: '200×4',                description: 'Multiplicación simple'       },
                  { id: '.calc 15% de 340',        title: '15% de 340',           description: 'Porcentaje'                  },
                  { id: '.calc 1000000 * 999999',  title: '1000000 × 999999',     description: 'Número grande exacto'        },
                ]
              },
              {
                title: '📐 Álgebra',
                rows: [
                  { id: '.calc 2x+5=13',           title: '2x + 5 = 13',          description: 'Ecuación lineal'             },
                  { id: '.calc x²+5x+6=0',         title: 'x² + 5x + 6 = 0',     description: 'Ecuación cuadrática'         },
                  { id: '.calc 3x+2y=5, x-y=1',   title: '3x+2y=5 / x-y=1',     description: 'Sistema de ecuaciones 2×2'   },
                ]
              },
              {
                title: '📏 Geometría y estadística',
                rows: [
                  { id: '.calc area circulo radio=7',  title: 'Área círculo r=7',  description: 'Área y perímetro'           },
                  { id: '.calc pitágoras 3, 4',        title: 'Pitágoras 3, 4',    description: 'Hipotenusa'                 },
                  { id: '.calc media 5 8 3 9 2',       title: 'Media 5 8 3 9 2',   description: 'Estadística descriptiva'    },
                ]
              },
              {
                title: '🔬 Avanzado',
                rows: [
                  { id: '.calc integral de x^2 de 0 a 3',    title: 'Integral de x² [0,3]', description: 'Integración numérica'   },
                  { id: '.calc derivada de x^3+2x en x=2',   title: "f'(x³+2x) en x=2",    description: 'Derivada numérica'      },
                  { id: '.calc C(10,3)',                       title: 'C(10,3)',              description: 'Combinaciones'          },
                  { id: '.calc sin(45°)',                     title: 'sin(45°)',             description: 'Trigonometría'          },
                  { id: '.calc MCM 12 18',                    title: 'MCM(12, 18)',          description: 'Mínimo Común Múltiplo'  },
                ]
              }
            ]
          })
        }
      ]
    })
    return true
  }

  try {
    const sol = resolver(problema)
    if (!sol) {
      await sock.sendMessage(jid, {
        text: '❓ No reconocí ese problema.\n\nPrueba con:\n• `200x4` / `15% de 200`\n• `2x+3=7` / `x²+5x+6=0`\n• `area circulo radio=5`\n• `sin(30°)` / `sqrt(144)`'
      }, { quoted: msg })
      return true
    }
    const pasosText = sol.pasos.map((p, i) => `  ${i + 1}. ${p}`).join('\n')
    await sock.sendMessage(jid, {
      text:
        `🧮 *${sol.tipo}*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📝 *Problema:* ${problema}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Procedimiento:*\n${pasosText}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `✅ *Resultado:* ${sol.resultado}`
    }, { quoted: msg })
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } })
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: msg })
  }

  return true
}
