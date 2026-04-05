'use client';

import { motion, useInView } from 'motion/react';
import { Search, User, Users, Zap, Settings2, Share2, ArrowRight, CheckCircle, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { useRef, useEffect, useState, useCallback } from 'react';
import { LandingNav } from '@/components/ui/LandingNav';

/* ─── Typewriter Terminal ─── */
function TypewriterLine({ text, delay }: { text: string; delay: number }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [inView, delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 22);
    return () => clearInterval(iv);
  }, [started, text]);

  return (
    <div ref={ref} className="font-mono text-[13px] leading-relaxed h-[22px]">
      {started && (
        <span className="text-orange-400">
          {'> '}{displayed}
          {displayed.length < text.length && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="inline-block w-[6px] h-[13px] bg-orange-400 ml-0.5 align-middle"
            />
          )}
        </span>
      )}
    </div>
  );
}

/* ─── Scroll reveal ─── */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Mouse-glow card ─── */
function GlowCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden ${className}`}
    >
      {hovered && (
        <div
          className="absolute w-[250px] h-[250px] rounded-full bg-orange-500/[0.06] blur-[60px] pointer-events-none"
          style={{ left: pos.x - 125, top: pos.y - 125 }}
        />
      )}
      {children}
    </div>
  );
}

/* ═══════════════ Hero background ═══════════════ */
function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">

      {/* Animated crossing wave curves */}
      <motion.svg
        className="absolute left-0 w-full"
        viewBox="0 0 1440 500"
        fill="none"
        preserveAspectRatio="none"
        style={{ height: '30%', bottom: '8%' }}
        animate={{ y: [0, -8, 0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
      >
        <motion.path
          d="M-50,400 C200,380 400,200 700,250 C1000,300 1200,150 1500,180"
          stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" fill="none"
          animate={{ d: ['M-50,400 C200,380 400,200 700,250 C1000,300 1200,150 1500,180', 'M-50,390 C200,360 400,220 700,230 C1000,280 1200,170 1500,200', 'M-50,400 C200,380 400,200 700,250 C1000,300 1200,150 1500,180'] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-50,420 C150,350 450,180 750,280 C1050,380 1250,200 1500,160"
          stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" fill="none"
          animate={{ d: ['M-50,420 C150,350 450,180 750,280 C1050,380 1250,200 1500,160', 'M-50,430 C150,370 450,200 750,260 C1050,360 1250,220 1500,180', 'M-50,420 C150,350 450,180 750,280 C1050,380 1250,200 1500,160'] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-50,350 C300,320 500,400 800,300 C1100,200 1300,350 1500,280"
          stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" fill="none"
          animate={{ d: ['M-50,350 C300,320 500,400 800,300 C1100,200 1300,350 1500,280', 'M-50,340 C300,340 500,380 800,320 C1100,220 1300,330 1500,260', 'M-50,350 C300,320 500,400 800,300 C1100,200 1300,350 1500,280'] }}
          transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-50,450 C250,400 500,300 720,350 C940,400 1150,250 1500,300"
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" fill="none"
          animate={{ d: ['M-50,450 C250,400 500,300 720,350 C940,400 1150,250 1500,300', 'M-50,460 C250,420 500,320 720,330 C940,380 1150,270 1500,320', 'M-50,450 C250,400 500,300 720,350 C940,400 1150,250 1500,300'] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-50,380 C180,280 480,350 780,220 C1080,90 1300,300 1500,250"
          stroke="rgba(255,255,255,0.045)" strokeWidth="0.5" fill="none"
          animate={{ d: ['M-50,380 C180,280 480,350 780,220 C1080,90 1300,300 1500,250', 'M-50,370 C180,300 480,330 780,240 C1080,110 1300,280 1500,230', 'M-50,380 C180,280 480,350 780,220 C1080,90 1300,300 1500,250'] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-50,460 C350,430 550,350 800,380 C1050,410 1200,300 1500,350"
          stroke="rgba(255,255,255,0.035)" strokeWidth="0.5" fill="none"
          animate={{ d: ['M-50,460 C350,430 550,350 800,380 C1050,410 1200,300 1500,350', 'M-50,470 C350,450 550,370 800,360 C1050,390 1200,320 1500,370', 'M-50,460 C350,430 550,350 800,380 C1050,410 1200,300 1500,350'] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-50,300 C200,350 450,250 700,320 C950,390 1150,280 1500,220"
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" fill="none"
          animate={{ d: ['M-50,300 C200,350 450,250 700,320 C950,390 1150,280 1500,220', 'M-50,310 C200,330 450,270 700,300 C950,370 1150,300 1500,240', 'M-50,300 C200,350 450,250 700,320 C950,390 1150,280 1500,220'] }}
          transition={{ repeat: Infinity, duration: 11, ease: 'easeInOut' }}
        />
      </motion.svg>
    </div>
  );
}

/* ═══════════════════════════ PAGE ═══════════════════════════ */

export default function Home() {
  return (
    <div className="bg-black text-white selection:bg-orange-500/30">

      {/* ═══ NAV ═══ */}
      <LandingNav extraLinks={[{ href: '#solution', label: '서비스 소개' }]} />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
        <HeroBackground />

        <div className="text-center px-6 max-w-[900px] mx-auto pt-16">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/25 bg-orange-500/[0.06] mb-10">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-orange-400">AI-Powered Travel Planner</span>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <h1 className="text-[clamp(2.8rem,7.5vw,6rem)] font-extrabold tracking-[-0.02em] leading-[1.1] mb-7">
              여행 계획,
              <br />
              15분이면 끝.
            </h1>
          </Reveal>

          <Reveal delay={0.24}>
            <p className="text-[clamp(0.95rem,2vw,1.15rem)] text-white/40 max-w-[500px] mx-auto mb-12 leading-[1.7]">
              MBTI부터 예산, 체력, 39가지 관심사까지.
              <br />
              당신만을 위한 여행 경로를 AI가 실시간으로 설계합니다.
            </p>
          </Reveal>

          <Reveal delay={0.36}>
            <Link href="/onboarding">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group px-10 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-bold text-[17px] transition-colors flex items-center gap-2.5 mx-auto"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </motion.button>
            </Link>
          </Reveal>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center pt-1.5"
          >
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-1 h-2 rounded-full bg-white/40"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ CHALLENGE ═══ */}
      <section className="py-28 px-8">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <p className="text-[11px] font-mono text-white/25 mb-3 tracking-[0.25em]">01 / CHALLENGE</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.01em] mb-5">
              여행 계획, 왜 이렇게 힘든 걸까?
            </h2>
            <p className="text-white/25 text-[15px] max-w-[480px] mb-14">
              평균 여행자는 하나의 여행을 계획하는 데 3~5일을 소비합니다.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: Search,
                title: '끝없는 리서치',
                desc: '수백 개의 블로그와 유튜브 사이에서 길을 잃으셨나요? 데이터 노이즈를 제거하고 정답만 보여드립니다.',
              },
              {
                icon: User,
                title: '내 취향 실종',
                desc: '남들이 다 가는 뻔한 코스는 지겹습니다. 당신의 라이프스타일과 성향을 100% 반영합니다.',
              },
              {
                icon: Users,
                title: '친구와 취향 전쟁',
                desc: '가고 싶은 곳이 다를 때의 스트레스. 모두가 만족할 수 있는 최적의 합의점을 AI가 계산합니다.',
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <GlowCard className="h-full rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-orange-500/20 transition-all duration-500">
                  <div className="p-7">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-5">
                      <item.icon className="w-[18px] h-[18px] text-orange-500" />
                    </div>
                    <h3 className="text-[17px] font-bold mb-2.5">{item.title}</h3>
                    <p className="text-[13.5px] text-white/30 leading-[1.75]">{item.desc}</p>
                  </div>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOLUTION ═══ */}
      <section id="solution" className="py-28 px-8 relative">
        {/* Subtle warm glow */}
        <div className="absolute top-1/2 -translate-y-1/2 left-[60%] w-[500px] h-[500px] bg-orange-600/[0.03] rounded-full blur-[150px] -z-10" />

        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            {/* Left */}
            <div>
              <Reveal>
                <p className="text-[11px] font-mono text-white/25 mb-3 tracking-[0.25em]">02 / CORE ENGINE</p>
                <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.01em] mb-12">
                  TripPlan이 해결합니다
                </h2>
              </Reveal>

              <div className="space-y-9">
                {[
                  { icon: Settings2, title: '성향 기반 맞춤 설계', desc: 'MBTI, 생활패턴, 39개 관심사 태그를 조합하여 고유한 여행 페르소나를 구축합니다.' },
                  { icon: Zap, title: 'AI 실시간 일정 생성', desc: '데이터를 수집하는 동안 실시간 스트리밍 방식으로 일정이 구성되는 것을 확인할 수 있습니다.' },
                  { icon: Share2, title: 'Travel Room 협업 기능', desc: '링크 하나로 친구들을 초대하세요. 실시간 수정과 투표로 완벽한 팀 워크를 완성합니다.' },
                ].map((item, i) => (
                  <Reveal key={i} delay={i * 0.1}>
                    <div className="flex gap-4 group">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center mt-0.5 group-hover:bg-orange-500/15 transition-colors">
                        <item.icon className="w-[18px] h-[18px] text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-[16px] font-bold mb-1">{item.title}</h3>
                        <p className="text-[13.5px] text-white/30 leading-[1.75]">{item.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Right — Terminal */}
            <Reveal delay={0.15}>
              <div className="rounded-2xl border border-white/[0.07] bg-[#0C0C0C] overflow-hidden">
                {/* macOS bar */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.05]">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <span className="text-[10px] text-white/15 ml-2 font-mono">tripplan-ai-engine</span>
                </div>

                {/* Lines */}
                <div className="p-5 space-y-1 min-h-[190px]">
                  <TypewriterLine text="ANALYZING_USER_PREFERENCE..." delay={0} />
                  <TypewriterLine text="MATCHING_LOCAL_SITES: TOKYO_SHIBUYA..." delay={500} />
                  <TypewriterLine text="OPTIMIZING_ROUTE_BY_STAMINA: LVL_3..." delay={1000} />
                  <TypewriterLine text="FETCHING_REAL_TIME_DATA..." delay={1500} />
                  <TypewriterLine text="ANALYZING_USER_PREFERENCE: ENFP" delay={2000} />
                  <TypewriterLine text="MAPPING_STAMINA_LEVEL: 3" delay={2500} />
                  <TypewriterLine text="CALCULATING_OPTIMAL_STAY: 4DAYS" delay={3000} />
                  <TypewriterLine text="STREAMING_RESULTS..." delay={3500} />
                </div>

                <div className="mx-5 border-t border-white/[0.05]" />

                {/* Result */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 2, duration: 0.6 }}
                  className="p-5"
                >
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="text-[9px] font-mono text-white/20 tracking-[0.2em] mb-2">REAL-TIME GENERATION</p>
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold">Day 1: Shibuya Peak</h4>
                      <span className="relative px-2.5 py-0.5 rounded-full border border-red-500/30 text-red-400 text-[10px] font-semibold">
                        LIVE
                        <motion.span
                          className="absolute inset-0 rounded-full border border-red-500/20"
                          animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: 'STAMINA', value: '85%' },
                      { label: 'BUDGET', value: '$$' },
                      { label: 'MODE', value: 'CURATED' },
                    ].map((s, i) => (
                      <div key={i} className="text-center py-1.5">
                        <p className="text-[9px] font-mono text-white/15 tracking-wider">{s.label}</p>
                        <p className="text-[13px] font-bold mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section id="proof" className="py-28 px-8">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <p className="text-[11px] font-mono text-white/25 mb-3 tracking-[0.25em]">03 / FIELD REPORTS</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.01em] mb-14">
              이미 시작한 여행자들
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                tag: '애니메이션 성지순례',
                quote: '"너의 이름은 배경지를 단 10분 만에 동선 낭비 없이 짰어요. 도보 시간까지 정확해서 놀랐습니다."',
                name: '김민수', trip: '도쿄 3박 4일', emoji: '👨‍💻',
              },
              {
                tag: '부모님 효도 여행',
                quote: '"체력이 약하신 부모님을 위해 휴식 시간을 넉넉히 넣은 일정이 필요했는데, AI가 완벽하게 배분해줬어요."',
                name: '이지은', trip: '교토 2박 3일', emoji: '👩‍🦰',
              },
              {
                tag: '우정 여행',
                quote: '"셋이서 가고 싶은 곳이 다 달랐는데, Travel Room으로 실시간 조율하니까 싸울 일이 없더라고요."',
                name: '박준영', trip: '제주 4박 5일', emoji: '🧑‍🎨',
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <GlowCard className="h-full rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-orange-500/20 transition-all duration-500">
                  <div className="p-7 flex flex-col h-full">
                    <span className="text-orange-400 text-[13px] font-semibold mb-4">{item.tag}</span>
                    <p className="text-white/50 leading-[1.8] flex-1 mb-6 text-[14px]">{item.quote}</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-white/[0.04]">
                      <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center text-base">{item.emoji}</div>
                      <div>
                        <p className="font-semibold text-[13px]">{item.name}</p>
                        <p className="text-[11px] text-white/20">{item.trip}</p>
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-28 px-8">
        <Reveal>
          <div className="max-w-[900px] mx-auto relative">
            <div className="relative rounded-3xl border border-orange-500/15 overflow-hidden">
              {/* Warm gradient background */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(180,70,10,0.1),rgba(0,0,0,0))]" />
              <div className="absolute inset-0 bg-black/40" />

              <div className="relative p-12 md:p-16 text-center">
                <h2 className="text-[clamp(1.6rem,4vw,2.8rem)] font-bold tracking-[-0.01em] mb-3">
                  다음 여행, 15분 만에 완성하세요
                </h2>
                <p className="text-white/30 text-[15px] mb-10">
                  지금 바로 AI 플래너를 무료로 체험해 보세요.
                </p>

                <Link href="/onboarding">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="group px-10 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-bold text-[17px] transition-colors flex items-center gap-2.5 mx-auto"
                  >
                    여행 계획 시작하기
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </motion.button>
                </Link>

                <div className="flex flex-wrap items-center justify-center gap-7 mt-8 text-[12px] text-white/25">
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-orange-500/40" /> AI 맞춤 일정 설계</span>
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-orange-500/40" /> 실시간 스트리밍 생성</span>
                  <span className="flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5 text-orange-500/40" /> Travel Room 협업</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.04] py-8 px-8">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-serif italic tracking-tight text-white/25">Tripplan</span>
          </div>
          <p className="text-[10px] text-white/12">&copy; 2026 TripPlan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
