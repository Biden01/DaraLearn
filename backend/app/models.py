"""Все модели — чтобы Alembic и create_all видели полную схему."""
from app.modules.content import models as content  # noqa: F401
from app.modules.decisions import models as decisions  # noqa: F401
from app.modules.events import models as events  # noqa: F401
from app.modules.leads import models as leads  # noqa: F401
from app.modules.school import models as school  # noqa: F401
from app.modules.tutor import models as tutor  # noqa: F401
from app.modules.verification import models as verification  # noqa: F401
