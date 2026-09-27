export type DependencyStatus = 'healthy' | 'down' | 'disabled';

export type DependencyHealth = {
  status: DependencyStatus;
  latencyMs: number;
};

export type HealthReport = {
  status: 'healthy' | 'unhealthy';
  version: string;
  services: {
    database: DependencyHealth;
    microsoftAuth: DependencyHealth;
    email: DependencyHealth;
    groq: DependencyHealth;
  };
};
