const e = React.createElement;

function useAdminFetch(endpoint) {
    const [data, setData] = React.useState([]);
    const password = window.localStorage.getItem('admin_pw') || '';
    React.useEffect(() => {
        fetch(endpoint, { headers: { 'x-admin-password': password } })
            .then(r => r.json())
            .then(setData)
            .catch(console.error);
    }, [endpoint, password]);
    return data;
}

function ExecutionLogs() {
    const logs = useAdminFetch('/api/execution-audit-logs');
    return e('div', null,
        e('h2', { className: 'text-xl mb-2' }, 'Execution Logs'),
        e('table', { className: 'table-dark' },
            e('thead', null,
                e('tr', null,
                    e('th', null, 'Trade'),
                    e('th', null, 'Type'),
                    e('th', null, 'Status'),
                    e('th', null, 'Time')
                )
            ),
            e('tbody', null,
                logs.map(log =>
                    e('tr', { key: log.id },
                        e('td', null, log.tradeId.slice(0, 8)),
                        e('td', null, log.type),
                        e('td', null, log.statusCode || ''),
                        e('td', null, new Date(log.timestamp).toLocaleString())
                    )
                )
            )
        )
    );
}

function ManualLabels() {
    const [editing, setEditing] = React.useState(null);
    const password = window.localStorage.getItem('admin_pw') || '';
    const labels = useAdminFetch('/api/manual-labels');

    function save(label) {
        fetch(`/api/manual-labels/${label.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': password
            },
            body: JSON.stringify({ label: label.label, confidence: label.confidence })
        }).then(() => setEditing(null));
    }

    return e('div', null,
        e('h2', { className: 'text-xl mb-2' }, 'Manual Labels'),
        e('table', { className: 'table-dark' },
            e('thead', null,
                e('tr', null,
                    e('th', null, 'Message'),
                    e('th', null, 'Label'),
                    e('th', null, 'Confidence'),
                    e('th', null, '')
                )
            ),
            e('tbody', null,
                labels.map(l =>
                    e('tr', { key: l.id },
                        e('td', null, l.messageId.slice(0, 8)),
                        editing === l.id ?
                            e('td', null,
                                e('input', {
                                    className: 'bg-gray-800 text-white p-1',
                                    value: l.label,
                                    onChange: ev => { l.label = ev.target.value; setEditing(l.id); }
                                })
                            ) : e('td', null, l.label),
                        editing === l.id ?
                            e('td', null,
                                e('input', {
                                    className: 'bg-gray-800 text-white p-1 w-20',
                                    value: l.confidence,
                                    onChange: ev => { l.confidence = parseFloat(ev.target.value); setEditing(l.id); }
                                })
                            ) : e('td', null, l.confidence),
                        e('td', null,
                            editing === l.id ?
                                e('button', { className: 'btn-primary', onClick: () => save(l) }, 'Save') :
                                e('button', { className: 'btn-primary', onClick: () => setEditing(l.id) }, 'Edit')
                        )
                    )
                )
            )
        )
    );
}

function ModelLogs() {
    const logs = useAdminFetch('/api/model-logs');
    return e('div', null,
        e('h2', { className: 'text-xl mb-2' }, 'Model Logs'),
        e('table', { className: 'table-dark' },
            e('thead', null,
                e('tr', null,
                    e('th', null, 'Message'),
                    e('th', null, 'Model'),
                    e('th', null, 'Created'),
                )
            ),
            e('tbody', null,
                logs.map(log =>
                    e('tr', { key: log.id },
                        e('td', null, log.messageId.slice(0,8)),
                        e('td', null, log.modelName),
                        e('td', null, new Date(log.createdAt).toLocaleString())
                    )
                )
            )
        )
    );
}

function JobLogs() {
    const logs = useAdminFetch('/api/job-logs');
    return e('div', null,
        e('h2', { className: 'text-xl mb-2' }, 'Job Logs'),
        e('table', { className: 'table-dark' },
            e('thead', null,
                e('tr', null,
                    e('th', null, 'Job'),
                    e('th', null, 'Status'),
                    e('th', null, 'Started'),
                    e('th', null, 'Ended')
                )
            ),
            e('tbody', null,
                logs.map(log =>
                    e('tr', { key: log.id },
                        e('td', null, log.jobName),
                        e('td', null, log.status),
                        e('td', null, new Date(log.startedAt).toLocaleString()),
                        e('td', null, log.endedAt ? new Date(log.endedAt).toLocaleString() : '-')
                    )
                )
            )
        )
    );
}

function ModelEval() {
    const results = useAdminFetch('/api/model-eval-results');
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        const data = results.slice().reverse();
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(r => new Date(r.date).toLocaleDateString()),
                datasets: [{
                    label: 'Accuracy',
                    data: data.map(r => ((r.truePositive + r.trueNegative) / r.totalTested) || 0),
                    borderColor: 'rgb(75, 192, 192)',
                    fill: false
                }]
            },
            options: { scales: { y: { beginAtZero: true, max: 1 } } }
        });
        return () => chart.destroy();
    }, [results]);

    return e('div', null,
        e('h2', { className: 'text-xl mb-2' }, 'Model Evaluation'),
        e('canvas', { ref: canvasRef, height: 200 })
    );
}

function AdminApp() {
    const [pw, setPw] = React.useState(localStorage.getItem('admin_pw') || '');
    const [tab, setTab] = React.useState('exec');
    if (!pw) {
        return e('div', { className: 'p-8' },
            e('h1', { className: 'text-2xl mb-4' }, 'Admin Login'),
            e('input', {
                className: 'bg-gray-800 p-2 mr-2',
                type: 'password',
                placeholder: 'Password',
                onChange: ev => setPw(ev.target.value)
            }),
            e('button', {
                className: 'btn-primary',
                onClick: () => { localStorage.setItem('admin_pw', pw); location.reload(); }
            }, 'Enter')
        );
    }
    const tabs = {
        exec: e(ExecutionLogs),
        labels: e(ManualLabels),
        logs: e(ModelLogs),
        jobs: e(JobLogs),
        eval: e(ModelEval)
    };
    return e('div', { className: 'flex' },
        e('aside', { className: 'w-48 bg-gray-800 min-h-screen p-4 space-y-2' },
            e('button', { className: 'w-full btn-primary', onClick: () => setTab('exec') }, 'Execution Logs'),
            e('button', { className: 'w-full btn-primary', onClick: () => setTab('labels') }, 'Manual Labels'),
            e('button', { className: 'w-full btn-primary', onClick: () => setTab('logs') }, 'Model Logs'),
            e('button', { className: 'w-full btn-primary', onClick: () => setTab('jobs') }, 'Job Logs'),
            e('button', { className: 'w-full btn-primary', onClick: () => setTab('eval') }, 'Model Eval'),
            e('button', { className: 'w-full bg-red-600 text-white p-2 mt-4', onClick: () => { localStorage.removeItem('admin_pw'); location.reload(); } }, 'Logout')
        ),
        e('main', { className: 'flex-1 p-4' }, tabs[tab])
    );
}

ReactDOM.render(e(AdminApp), document.getElementById('admin-root'));
