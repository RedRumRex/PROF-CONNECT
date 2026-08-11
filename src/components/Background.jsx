export default function Background() {
  return (
    <>
      <div
        className="fixed inset-0 -z-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #2d1413 0%, #1d0807 100%)',
        }}
      />
      <div
        className="fixed inset-0 -z-10 animate-gradient-pulse pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(139,0,0,0.22) 0%, transparent 45%), ' +
            'radial-gradient(circle at 75% 80%, rgba(95,20,16,0.16) 0%, transparent 45%)',
        }}
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(#ffb4a8 0.6px, transparent 0.6px)',
          backgroundSize: '36px 36px',
        }}
      />
    </>
  )
}