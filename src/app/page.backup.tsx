'use client';

import { motion } from 'motion/react';
import { MapPin, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
            <Sparkles className="w-6 h-6 text-orange-500" />
          </div>
          <span className="text-sm font-medium tracking-[0.2em] uppercase text-white/60">AI-Powered Travel</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-light tracking-tight mb-8 leading-[0.9]">
          Your Journey, <br />
          <span className="italic font-serif">Perfectly</span> Planned.
        </h1>

        <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
          AI가 당신의 성향을 분석하여 맞춤형 여행 일정을 설계합니다
        </p>

        <Link href="/onboarding">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative px-8 py-4 bg-white text-black rounded-full font-medium text-lg overflow-hidden transition-all hover:pr-12"
          >
            <span>여행 시작하기</span>
            <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all" />
          </motion.button>
        </Link>
      </motion.div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
        {[
          { icon: MapPin, title: "맞춤 설계", desc: "MBTI와 취향에 맞는 맞춤 일정" },
          { icon: Sparkles, title: "AI 기반", desc: "스마트 경로 최적화" },
          { icon: MapPin, title: "유연한 수정", desc: "쉽게 수정하고 재생성" }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-left"
          >
            <feature.icon className="w-6 h-6 text-orange-500 mb-4" />
            <h3 className="font-medium mb-2">{feature.title}</h3>
            <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
