import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformanceService, PerformanceMetrics } from '../../services/performance.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-dashboard.component.html',
  styleUrls: ['./performance-dashboard.component.css']
})
export class PerformanceDashboardComponent implements OnInit {
  metrics: PerformanceMetrics | null = null;
  isLoading = false;
  isRunningTest = false;
  
  // Charts
  responseTimeChart: Chart | null = null;
  cacheHitChart: Chart | null = null;

  constructor(
    private performanceService: PerformanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.isLoading = true;
    this.performanceService.getMetrics().subscribe({
      next: (data) => {
        this.metrics = data;
        this.isLoading = false;
        this.updateCharts();
      },
      error: (error) => {
        console.error('Error loading metrics:', error);
        this.isLoading = false;
      }
    });
  }

  runTest(iterations: number = 50): void {
    this.isRunningTest = true;
    console.log(`Starting performance test with ${iterations} iterations...`);

    this.performanceService.runPerformanceTest(iterations).subscribe({
      next: (data) => {
        this.metrics = data;
        this.isRunningTest = false;
        this.cdr.detectChanges();
        this.updateCharts();
        console.log('✓ Performance test completed!');
      },
      error: (error) => {
        console.error('Error running test:', error);
        this.isRunningTest = false;
      }
    });
  }

  resetMetrics(): void {
    if (confirm('Reset all performance metrics?')) {
      this.performanceService.resetMetrics().subscribe({
        next: () => {
          console.log('✓ Metrics reset');
          this.loadMetrics();
        },
        error: (error) => {
          console.error('Error resetting metrics:', error);
        }
      });
    }
  }

  updateCharts(): void {
    if (!this.metrics || !this.metrics.strategies) return;

    // Destroy old charts
    if (this.responseTimeChart) this.responseTimeChart.destroy();
    if (this.cacheHitChart) this.cacheHitChart.destroy();

    // Response Time Chart
    const strategies = Object.keys(this.metrics.strategies);
    const avgTimes = strategies.map(s => this.metrics!.strategies[s].averageResponseTime);
    const p95Times = strategies.map(s => this.metrics!.strategies[s].p95ResponseTime);

    const ctx1 = document.getElementById('responseTimeChart') as HTMLCanvasElement;
    if (ctx1) {
      this.responseTimeChart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: strategies,
          datasets: [
            {
              label: 'Average Response Time (ms)',
              data: avgTimes,
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            },
            {
              label: 'P95 Response Time (ms)',
              data: p95Times,
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Response Time (ms)'
              }
            }
          }
        }
      });
    }

    // Cache Hit Rate Chart
    const cacheRates = strategies.map(s => this.metrics!.strategies[s].cacheHitRate);
    
    const ctx2 = document.getElementById('cacheHitChart') as HTMLCanvasElement;
    if (ctx2) {
      this.cacheHitChart = new Chart(ctx2, {
        type: 'pie',
        data: {
          labels: strategies,
          datasets: [{
            data: cacheRates,
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 206, 86, 0.6)',
              'rgba(75, 192, 192, 0.6)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            },
            title: {
              display: true,
              text: 'Cache Hit Rate by Strategy'
            }
          }
        }
      });
    }
  }

  getStrategyKeys(): string[] {
    return this.metrics?.strategies ? Object.keys(this.metrics.strategies) : [];
  }

  getOptimalStrategy(): string {
    if (!this.metrics || !this.metrics.strategies) return 'N/A';
    
    const strategies = Object.entries(this.metrics.strategies);
    if (strategies.length === 0) return 'N/A';

    // Find strategy with best balance (lowest avg time with >80% cache hit rate)
    const viable = strategies.filter(([_, metrics]) => metrics.cacheHitRate > 80);
    
    if (viable.length === 0) {
      return strategies.reduce((best, current) => 
        current[1].averageResponseTime < best[1].averageResponseTime ? current : best
      )[0];
    }

    return viable.reduce((best, current) =>
      current[1].averageResponseTime < best[1].averageResponseTime ? current : best
    )[0];
  }

  /**
   * Returns the strategy key with the lowest average response time
   */
  getSpeedWinner(): string {
    const keys = this.getStrategyKeys();
    if (!keys.length) return 'N/A';
    return keys.reduce((best, current) =>
      this.metrics!.strategies[current].averageResponseTime < this.metrics!.strategies[best].averageResponseTime ? current : best
    );
  }

  /**
   * Returns the strategy key with the highest cache hit rate
   */
  getCacheChampion(): string {
    const keys = this.getStrategyKeys();
    if (!keys.length) return 'N/A';
    return keys.reduce((best, current) =>
      this.metrics!.strategies[current].cacheHitRate > this.metrics!.strategies[best].cacheHitRate ? current : best
    );
  }

  /**
   * Returns the strategy key with the smallest difference between min and max response time
   */
  getMostConsistent(): string {
    const keys = this.getStrategyKeys();
    if (!keys.length) return 'N/A';
    return keys.reduce((best, current) => {
      const currentDiff = this.metrics!.strategies[current].maxResponseTime - this.metrics!.strategies[current].minResponseTime;
      const bestDiff = this.metrics!.strategies[best].maxResponseTime - this.metrics!.strategies[best].minResponseTime;
      return currentDiff < bestDiff ? current : best;
    });
  }
}