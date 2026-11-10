import { useState } from 'react';
import { parsePhotos } from '../utils/property';

export default function PropertyImageCarousel({ photos, address }) {
  const urls = parsePhotos(photos);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState({});
  const photo = urls[index];
  function move(event, direction) {
    event.preventDefault();
    event.stopPropagation();
    setIndex(current => (current + direction + urls.length) % urls.length);
  }
  return <div className="property-photo" role="group" aria-label={`Photos of ${address}`}>
    {photo && !failed[photo]
      ? <img key={photo} src={photo} alt={`${address}, view ${index + 1}`} loading="lazy" onError={() => setFailed(current => ({ ...current, [photo]: true }))} />
      : <div className="photo-placeholder"><span>Photo unavailable</span></div>}
    {urls.length > 1 && <>
      <button className="photo-arrow photo-previous" aria-label="Previous photo" onClick={event => move(event, -1)}>‹</button>
      <button className="photo-arrow photo-next" aria-label="Next photo" onClick={event => move(event, 1)}>›</button>
    </>}
    {urls.length > 0 && <span className="photo-counter" aria-live="polite" aria-atomic="true">{index + 1} / {urls.length}</span>}
  </div>;
}
