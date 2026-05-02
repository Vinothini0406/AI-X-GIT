const particles = [
  { left: "9%", top: "20%", size: "size-1.5", delay: "-1s", duration: "9s" },
  { left: "22%", top: "72%", size: "size-1", delay: "-5s", duration: "11s" },
  {
    left: "39%",
    top: "13%",
    size: "size-1.5",
    delay: "-7s",
    duration: "13s",
  },
  { left: "58%", top: "78%", size: "size-1", delay: "-3s", duration: "10s" },
  {
    left: "76%",
    top: "22%",
    size: "size-1.5",
    delay: "-9s",
    duration: "12s",
  },
  { left: "90%", top: "62%", size: "size-1", delay: "-4s", duration: "14s" },
] as const;

export function AnimatedLandingBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="landing-soft-gradient absolute inset-0" />
      <div className="landing-grid-flow absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_0%,black_48%,transparent_76%)] opacity-70" />
      <div className="landing-noise absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_70%,transparent)]" />

      <div className="landing-glow-pulse absolute top-4 left-1/2 h-[28rem] w-[42rem] -translate-x-1/2 rounded-full bg-black/[0.08] blur-3xl" />
      <div className="landing-glow-pulse absolute right-[-8rem] bottom-10 h-72 w-72 rounded-full border border-black/10 bg-white/50 blur-2xl [animation-delay:-4s]" />
      <div className="landing-glow-pulse absolute bottom-20 left-[-7rem] h-64 w-64 rounded-full border border-black/10 bg-white/60 blur-2xl [animation-delay:-7s]" />

      <div className="landing-float-slow absolute top-[21%] left-[7%] hidden h-24 w-44 rotate-[-7deg] rounded-xl border border-black/10 bg-white/50 shadow-[0_24px_70px_rgba(0,0,0,0.08)] backdrop-blur-md md:block">
        <div className="flex h-full flex-col justify-between p-4">
          <div className="h-1.5 w-12 rounded-full bg-black/20" />
          <div className="space-y-2">
            <div className="h-1.5 w-28 rounded-full bg-black/10" />
            <div className="h-1.5 w-20 rounded-full bg-black/10" />
          </div>
        </div>
      </div>
      <div className="landing-float-medium absolute top-[25%] right-[8%] hidden h-28 w-36 rotate-[6deg] rounded-xl border border-black/10 bg-white/45 shadow-[0_24px_70px_rgba(0,0,0,0.08)] backdrop-blur-md [animation-delay:-3s] lg:block">
        <div className="grid h-full grid-cols-3 gap-2 p-4">
          <div className="rounded-md bg-black/10" />
          <div className="rounded-md bg-black/15" />
          <div className="rounded-md bg-black/10" />
          <div className="col-span-2 rounded-md bg-black/10" />
          <div className="rounded-md bg-black/20" />
        </div>
      </div>
      <div className="landing-float-slow absolute bottom-[16%] left-[17%] hidden h-16 w-56 rotate-[4deg] items-center gap-3 rounded-full border border-black/10 bg-white/55 px-4 shadow-[0_24px_70px_rgba(0,0,0,0.08)] backdrop-blur-md [animation-delay:-6s] sm:flex">
        <div className="size-8 rounded-full bg-black/10" />
        <div className="space-y-2">
          <div className="h-1.5 w-24 rounded-full bg-black/20" />
          <div className="h-1.5 w-32 rounded-full bg-black/10" />
        </div>
      </div>

      {particles.map((particle, index) => (
        <span
          key={`${particle.left}-${particle.top}-${index}`}
          className={`landing-particle absolute rounded-full bg-black ${particle.size}`}
          style={{
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            left: particle.left,
            top: particle.top,
          }}
        />
      ))}

      <div className="from-background via-background/90 absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t to-transparent" />
      <div className="from-background via-background/65 absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent" />
    </div>
  );
}
