import { useState } from 'react';
import { firstPhoto, numberLabel, priceLabel } from '../utils/property';

export default function PropertyCard({ property }) {
  const photo = firstPhoto(property.L_Photos);
  const [failedPhoto, setFailedPhoto] = useState(null);
  const address = property.L_Address || 'Address unavailable';
  const location = [property.L_City, property.L_State, property.L_Zip].filter(Boolean).join(', ');
  return (
    <article className="property-card" aria-label={address}>
      <div className="property-photo">
        {photo && photo !== failedPhoto ? (
          <img src={photo} alt={`Exterior of ${address}`} loading="lazy" onError={() => setFailedPhoto(photo)} />
        ) : (
          <div className="photo-placeholder">
            <svg width="42" height="42" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M4 15 16 5l12 10M8 12v15h16V12M13 27v-9h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span>Photo unavailable</span>
          </div>
        )}
      </div>
      <div className="property-body">
        <p className="property-price">{priceLabel(property.L_SystemPrice)}</p>
        <h3>{address}</h3>
        <p className="property-location">{location || 'Location unavailable'}</p>
        <dl className="property-facts">
          <div><dt>Beds</dt><dd>{numberLabel(property.L_Keyword2)}</dd></div>
          <div><dt>Baths</dt><dd>{numberLabel(property.LM_Dec_3)}</dd></div>
          <div><dt>Sq ft</dt><dd>{numberLabel(property.LM_Int2_3)}</dd></div>
        </dl>
      </div>
    </article>
  );
}
