interface UiStateProps {
  message: string;
}

export const LoadingState = ({ message }: UiStateProps) => {
  return <div className="ui-loading">{message}</div>;
};

export const EmptyState = ({ message }: UiStateProps) => {
  return <div className="ui-empty-state">{message}</div>;
};

export const ErrorState = ({ message }: UiStateProps) => {
  return <div className="ui-error-state">{message}</div>;
};
