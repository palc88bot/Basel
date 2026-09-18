export class PositionMonitor {
  private startTime: number = 0;
  
  constructor(
    private halfLifeSeconds: number,
    private entryZScore: number
  ) {}

  start() {
    this.startTime = Date.now();
  }

  checkExit(currentZScore: number): { shouldClose: boolean; reason: string; urgency: 'NORMAL' | 'HIGH' | 'CRITICAL' } {
    if (this.startTime === 0) return { shouldClose: false, reason: 'Not started', urgency: 'NORMAL' };
    
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const maxAllowedTime = this.halfLifeSeconds * 2.0;

    // 1. جني الربح المبكر
    if (Math.abs(currentZScore) <= 0.5) {
      return { shouldClose: true, reason: `Target Reached (Z=${currentZScore.toFixed(2)})`, urgency: 'NORMAL' };
    }

    // 2. الخروج الزمني الإجباري (الحل الجذري للسيناريو ب)
    if (elapsedSeconds > maxAllowedTime) {
      return { shouldClose: true, reason: `Time Exit (${elapsedSeconds.toFixed(0)}s > ${maxAllowedTime.toFixed(0)}s)`, urgency: 'HIGH' };
    }

    // 3. وقف الخسارة الصارم
    if ((this.entryZScore > 0 && currentZScore >= 3.5) || (this.entryZScore < 0 && currentZScore <= -3.5)) {
      return { shouldClose: true, reason: `Stop Loss (Z=${currentZScore.toFixed(2)})`, urgency: 'CRITICAL' };
    }

    return { shouldClose: false, reason: 'Hold', urgency: 'NORMAL' };
  }
}
