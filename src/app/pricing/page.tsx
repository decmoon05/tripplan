'use client';

import { motion, useInView } from 'motion/react';
import { Check, X, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { LandingNav } from '@/components/ui/LandingNav';

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

const plans = [
  {
    name: 'Free',
    price: '₩0',
    period: '영구 무료',
    description: '개인 여행자를 위한 기본 플랜',
    highlight: false,
    features: [
      { text: '월 3회 일정 생성', included: true },
      { text: 'AI 맞춤 추천', included: true },
      { text: 'MBTI 기반 분석', included: true },
      { text: '일정 수정 (일 5회)', included: true },
      { text: 'Travel Room', included: false },
      { text: '실시간 스트리밍 생성', included: false },
      { text: '일정 공유 링크', included: false },
      { text: '우선 지원', included: false },
    ],
    cta: '무료로 시작',
    ctaLink: '/auth/signup',
  },
  {
    name: 'Pro',
    price: '₩9,900',
    period: '/월',
    description: '자주 여행하는 분을 위한 프리미엄',
    highlight: true,
    features: [
      { text: '무제한 일정 생성', included: true },
      { text: 'AI 맞춤 추천', included: true },
      { text: 'MBTI 기반 분석', included: true },
      { text: '무제한 일정 수정', included: true },
      { text: 'Travel Room (최대 6명)', included: true },
      { text: '실시간 스트리밍 생성', included: true },
      { text: '일정 공유 링크', included: true },
      { text: '우선 지원', included: false },
    ],
    cta: 'Pro 시작하기',
    ctaLink: '/auth/signup',
  },
  {
    name: 'Team',
    price: '₩29,900',
    period: '/월',
    description: '단체 여행·기업 워크숍에 최적화',
    highlight: false,
    features: [
      { text: '무제한 일정 생성', included: true },
      { text: 'AI 맞춤 추천', included: true },
      { text: 'MBTI 기반 분석', included: true },
      { text: '무제한 일정 수정', included: true },
      { text: 'Travel Room (최대 20명)', included: true },
      { text: '실시간 스트리밍 생성', included: true },
      { text: '일정 공유 링크', included: true },
      { text: '우선 지원 (24시간)', included: true },
    ],
    cta: '문의하기',
    ctaLink: '/auth/signup',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <LandingNav extraLinks={[{ href: '/#solution', label: '서비스 소개' }]} />

      {/* Header */}
      <section className="pt-32 pb-16 px-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/25 bg-orange-500/[0.06] mb-8">
            <Zap className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-orange-400">Pricing</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            당신에게 맞는 플랜을 선택하세요
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="text-white/35 text-lg max-w-lg mx-auto">
            모든 플랜에서 AI 맞춤 여행 일정을 체험할 수 있습니다.
          </p>
        </Reveal>
      </section>

      {/* Plans */}
      <section className="pb-32 px-8">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1}>
              <div className={`relative rounded-2xl border p-8 flex flex-col h-full transition-all duration-300 ${
                plan.highlight
                  ? 'border-orange-500/40 bg-orange-500/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-black text-[11px] font-bold rounded-full tracking-wider uppercase">
                    인기
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-[13px] text-white/30">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                  <span className="text-white/30 text-sm ml-1">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-3 text-[13.5px]">
                      {f.included ? (
                        <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-white/15 flex-shrink-0" />
                      )}
                      <span className={f.included ? 'text-white/70' : 'text-white/20'}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.ctaLink}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3.5 rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2 ${
                      plan.highlight
                        ? 'bg-orange-500 hover:bg-orange-400 text-white'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/80'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 px-8">
        <div className="max-w-[700px] mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold mb-10 text-center">자주 묻는 질문</h2>
          </Reveal>
          {[
            { q: '무료 플랜으로도 충분한가요?', a: '월 3회 여행 계획이면 충분합니다. 더 자주 여행하시거나 Travel Room이 필요하시면 Pro를 추천합니다.' },
            { q: '결제는 어떻게 하나요?', a: '카드 결제를 지원하며, 언제든 구독을 취소할 수 있습니다. 위약금은 없습니다.' },
            { q: 'Pro에서 Team으로 업그레이드 가능한가요?', a: '네, 언제든 플랜을 변경할 수 있습니다. 이미 결제한 기간은 일할 계산으로 차감됩니다.' },
            { q: 'Travel Room은 무엇인가요?', a: '여러 명이 한 방에서 각자의 취향을 입력하면, AI가 모든 사람의 선호도를 종합해 최적의 일정을 생성합니다.' },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="border-b border-white/[0.05] py-5">
                <h3 className="font-semibold text-[15px] mb-2 text-white/80">{item.q}</h3>
                <p className="text-[13.5px] text-white/35 leading-[1.7]">{item.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 px-8">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-serif italic tracking-tight text-white/25">Tripplan</span>
          </div>
          <p className="text-[10px] text-white/15">&copy; 2026 TripPlan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
