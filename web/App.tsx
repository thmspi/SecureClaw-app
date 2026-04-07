'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'framer-motion';

type Feature = {
  title: string;
  description: string;
  colorImage: string;
  color: string;
  gradient: string;
};

const FEATURES: Feature[] = [
  {
    title: 'Powerful Agent',
    description: 'Visual runtime orchestration with deterministic OpenClaw session flow.',
    colorImage: './img/colored-lobster.png',
    color: '#ff6b00',
    gradient: 'from-orange-500/20 to-orange-600/10'
  },
  {
    title: 'Security First',
    description: 'Lock-first policy posture with NemoClaw strict boundaries.',
    colorImage: './img/blue-lobster.png',
    color: '#00a8ff',
    gradient: 'from-blue-500/20 to-cyan-500/10'
  },
  {
    title: 'Easy Install',
    description: 'Guided setup from prerequisites to ready-to-run sessions.',
    colorImage: './img/green-lobster.png',
    color: '#00cc66',
    gradient: 'from-emerald-500/20 to-green-500/10'
  }
];

// Spring physics config (MOTION_INTENSITY=6)
const springConfig = { stiffness: 100, damping: 20, mass: 0.8 };

// Stagger orchestration variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      ...springConfig
    }
  }
};

// Isolated perpetual animation component
const FloatingLobster = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <motion.img
      src={src}
      alt={alt}
      className="lobster-hero-img"
      animate={{
        y: [-8, 8, -8],
        rotate: [-2, 2, -2]
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Magnetic hover button (isolated Client Component)
const MagneticButton = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      className="btn"
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.98, y: 1 }}
    >
      {children}
    </motion.a>
  );
};

function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-container">
        {/* Asymmetric Layout: Left text, Right visual (DESIGN_VARIANCE=8) */}
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', ...springConfig, delay: 0.1 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="hero-badge"
          >
            Secure Agent Operations
          </motion.div>
          
          <h1 className="hero-title">
            SecureClaw
          </h1>
          
          <p className="hero-description">
            Runtime control for serious AI teams. Install, configure, and operate OpenClaw and NemoClaw workloads with enterprise-grade security.
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="hero-actions"
          >
            <MagneticButton href="https://github.com/thmspi/SecureClaw-app">
              Request Access
            </MagneticButton>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', ...springConfig, delay: 0.2 }}
        >
          <div className="hero-lobster-container">
            <FloatingLobster src="./img/colored-lobster.png" alt="SecureClaw" />
            
            {/* Perpetual pulse ring (MOTION_INTENSITY=6) */}
            <motion.div
              className="pulse-ring"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.3, 0, 0.3]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section className="features-section">
      <div className="features-container">
        {/* Eyebrow + Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ 
            duration: 0.8,
            ease: [0.32, 0.72, 0, 1]
          }}
          className="features-header"
        >
          <div className="eyebrow-tag">
            Built for Production
          </div>
          <h2>Enterprise-Grade Infrastructure</h2>
        </motion.div>

        {/* Z-Axis Cascade: 3 overlapping cards */}
        <div className="features-cascade">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="cascade-card-wrapper"
              initial={{ opacity: 0, y: 60, rotateX: 15 }}
              whileInView={{ 
                opacity: 1, 
                y: 0, 
                rotateX: 0,
                transition: {
                  duration: 0.9,
                  delay: index * 0.15,
                  ease: [0.32, 0.72, 0, 1]
                }
              }}
              viewport={{ once: true, margin: "-50px" }}
              onHoverStart={() => setActiveIndex(index)}
              onHoverEnd={() => setActiveIndex(null)}
              whileHover={{
                y: -12,
                scale: 1.02,
                zIndex: 10,
                transition: { 
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                }
              }}
              style={{
                zIndex: activeIndex === index ? 10 : 3 - index
              }}
            >
              {/* Double-Bezel Outer Shell */}
              <div className="bezel-outer">
                {/* Double-Bezel Inner Core */}
                <div 
                  className={`bezel-inner bg-gradient-to-br ${feature.gradient}`}
                  style={{
                    borderColor: activeIndex === index ? feature.color : undefined
                  }}
                >
                  {/* Glow effect on hover */}
                  <motion.div
                    className="feature-glow"
                    animate={{
                      opacity: activeIndex === index ? 0.4 : 0,
                      scale: activeIndex === index ? 1 : 0.8
                    }}
                    transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                    style={{
                      background: `radial-gradient(circle at center, ${feature.color}, transparent 70%)`
                    }}
                  />

                  <div className="feature-content-compact">
                    {/* Icon/Visual */}
                    <motion.div 
                      className="feature-icon-compact"
                      animate={{
                        scale: activeIndex === index ? 1.1 : 1,
                        rotate: activeIndex === index ? [0, -5, 5, 0] : 0
                      }}
                      transition={{ 
                        duration: 0.6,
                        ease: [0.32, 0.72, 0, 1]
                      }}
                    >
                      <img
                        src={activeIndex === index ? feature.colorImage : './img/greyed lobster.png'}
                        alt=""
                        className="feature-img-compact"
                        style={{
                          filter: activeIndex === index ? `drop-shadow(0 0 20px ${feature.color}80)` : 'none'
                        }}
                      />
                    </motion.div>

                    {/* Text Content */}
                    <div className="feature-text-compact">
                      <h3 
                        className="feature-title-compact"
                        style={{ 
                          color: activeIndex === index ? feature.color : undefined 
                        }}
                      >
                        {feature.title}
                      </h3>
                      <p className="feature-desc-compact">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <Fragment>
      <motion.header
        className="header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...springConfig }}
      >
        <a className="logo" href="#top" aria-label="SecureClaw home">
          SecureClaw
        </a>
        
        <motion.a
          href="mailto:secureclaw@test.com"
          className="contact-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          Contact
        </motion.a>
      </motion.header>

      <main id="top">
        <HeroSection />
        <FeaturesSection />

        <motion.section
          className="cta"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Ready to get started?</h2>
          <MagneticButton href="https://github.com/thmspi/SecureClaw-app">
            Request Access
          </MagneticButton>
        </motion.section>
      </main>

      <footer className="footer">
        <p>SecureClaw — Runtime control for serious AI teams.</p>
        <nav className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="https://github.com/thmspi/SecureClaw-app" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </footer>
    </Fragment>
  );
}
