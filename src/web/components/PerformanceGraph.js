import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const PerformanceGraph = ({ data }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        const initChart = () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }

            const canvas = chartRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set canvas dimensions
            canvas.height = 300;
            canvas.width = canvas.parentElement.clientWidth;

            chartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => new Date(d.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Performance',
                        data: data.map(d => d.performance),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            titleColor: '#000',
                            bodyColor: '#666',
                            borderColor: '#ddd',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                color: '#666'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                color: '#666'
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        };

        initChart();

        const handleResize = () => {
            if (chartRef.current && chartInstance.current) {
                chartRef.current.width = chartRef.current.parentElement.clientWidth;
                chartInstance.current.resize();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [data]);

    return (
        <div className="w-full h-full">
            <canvas ref={chartRef} />
        </div>
    );
};

export default PerformanceGraph; 