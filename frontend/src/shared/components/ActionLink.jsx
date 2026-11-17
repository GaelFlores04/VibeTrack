import { Link } from 'react-router-dom';
import Icon from './Icon';

// Navegar sigue siendo un enlace, aunque la acción se presente como un control.
export default function ActionLink({ to, href, icon, children, className = '', ...props }) {
  const content = <>{icon && <Icon name={icon} size={17} />}<span>{children}</span></>;
  const classes = `action-link ${className}`.trim();
  return to
    ? <Link className={classes} to={to} {...props}>{content}</Link>
    : <a className={classes} href={href} target="_blank" rel="noreferrer" {...props}>{content}</a>;
}
